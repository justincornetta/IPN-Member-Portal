"""
IPN Analytics Dashboard — Eventbrite Data Pull
Pulls event ticket sales, revenue, and attendance data from Eventbrite API.
Saves data to JSON files in the data/ folder for the dashboard to consume.

Usage:
    python eventbrite_pull.py

Requires:
    - requests library (pip install requests)
    - EVENTBRITE_API_TOKEN in ../.env or ../../workspace/.env
    - EVENTBRITE_ORG_ID (optional — auto-discovered if not set)

Output files (in ../data/):
    - eventbrite_events.json    — all events with tickets, sales, attendance
    - eventbrite_last_pull.json — timestamp of last successful pull
"""

import requests
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
ENV_PATHS = [
    PROJECT_DIR / ".env",
    PROJECT_DIR / ".env.local",
    PROJECT_DIR.parent / "workspace" / ".env",
    Path.home() / ".openclaw" / "workspace" / ".env",
]

BASE_URL = "https://www.eventbriteapi.com/v3"


def load_env():
    """Load API token from .env file."""
    for env_path in ENV_PATHS:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ.setdefault(key.strip(), val.strip())

    token = os.environ.get("EVENTBRITE_API_TOKEN")
    if not token:
        raise ValueError("EVENTBRITE_API_TOKEN not found in .env")
    return token


def api_get(token, endpoint, params=None):
    """Make a GET request to the Eventbrite API."""
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(f"{BASE_URL}{endpoint}", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def paginate(token, endpoint, key, params=None):
    """Paginate through results. Eventbrite uses continuation tokens or page numbers."""
    all_items = []
    params = dict(params or {})

    # Try continuation-based pagination first (orders, attendees)
    while True:
        data = api_get(token, endpoint, params=params)
        items = data.get(key, [])
        all_items.extend(items)

        pagination = data.get("pagination", {})
        continuation = pagination.get("continuation")
        if continuation and pagination.get("has_more_items", False):
            params["continuation"] = continuation
        elif pagination.get("page_number") and pagination.get("page_count"):
            page = pagination["page_number"]
            total_pages = pagination["page_count"]
            if page < total_pages:
                params["page"] = page + 1
            else:
                break
        else:
            break

    return all_items


def cents_to_dollars(value):
    """Convert Eventbrite cent-based amounts to dollars."""
    if isinstance(value, (int, float)):
        return round(value / 100, 2)
    return 0.0


def save_json(filename, data):
    """Save data to a JSON file in the data directory."""
    filepath = DATA_DIR / filename
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved: {filepath}")


# ── Data Pull Functions ─────────────────────────────────────────────

def discover_org_id(token):
    """Auto-discover the organization ID."""
    data = api_get(token, "/users/me/organizations/")
    orgs = data.get("organizations", [])
    if not orgs:
        raise ValueError("No organizations found for this Eventbrite account")
    org = orgs[0]
    print(f"  Organization: {org.get('name')} (ID: {org['id']})")
    return org["id"], org.get("name", "")


def pull_events(token, org_id):
    """Pull all events for the organization."""
    print("\n1. Pulling events...")
    events = paginate(token, f"/organizations/{org_id}/events/",
                      key="events",
                      params={"status": "all", "order_by": "start_desc"})

    result = []
    for evt in events:
        start = evt.get("start", {})
        end = evt.get("end", {})
        result.append({
            "id": evt["id"],
            "name": evt.get("name", {}).get("text", "Untitled"),
            "status": evt.get("status", ""),
            "start": start.get("utc", ""),
            "end": end.get("utc", ""),
            "url": evt.get("url", ""),
            "capacity": evt.get("capacity"),
            "is_free": evt.get("is_free", False),
            "online_event": evt.get("online_event", False),
        })
        print(f"  Event: {result[-1]['name']} ({result[-1]['status']})")

    print(f"  Total events: {len(result)}")
    return result


def pull_ticket_classes(token, event_id, event_name):
    """Pull ticket classes for an event."""
    data = api_get(token, f"/events/{event_id}/ticket_classes/")
    classes = data.get("ticket_classes", [])

    result = []
    total_capacity = 0
    total_sold = 0

    for tc in classes:
        cost = tc.get("cost", {})
        cost_dollars = cents_to_dollars(cost.get("value", 0)) if cost else 0.0
        qty_total = tc.get("quantity_total", 0) or 0
        qty_sold = tc.get("quantity_sold", 0) or 0
        total_capacity += qty_total
        total_sold += qty_sold

        result.append({
            "name": tc.get("name", ""),
            "cost_dollars": cost_dollars,
            "free": tc.get("free", False),
            "quantity_total": qty_total,
            "quantity_sold": qty_sold,
            "on_sale_status": tc.get("on_sale_status", ""),
        })

    sell_through = round((total_sold / total_capacity * 100), 1) if total_capacity > 0 else 0
    print(f"    Tickets: {total_sold}/{total_capacity} sold ({sell_through}% sell-through)")

    return result, total_capacity, total_sold, sell_through


def pull_orders(token, event_id, event_name):
    """Pull all orders for an event and compute revenue."""
    orders = paginate(token, f"/events/{event_id}/orders/", key="orders")

    total_gross = 0.0
    total_net = 0.0
    total_fees = 0.0
    active_orders = 0
    daily_sales = defaultdict(lambda: {"tickets": 0, "gross": 0.0})

    for order in orders:
        status = order.get("status", "")
        if status not in ("placed", "active"):
            continue

        active_orders += 1
        costs = order.get("costs", {})

        gross = cents_to_dollars(costs.get("gross", {}).get("value", 0))
        fees = cents_to_dollars(costs.get("eventbrite_fee", {}).get("value", 0))
        fees += cents_to_dollars(costs.get("payment_fee", {}).get("value", 0))
        net = gross - fees

        total_gross += gross
        total_fees += fees
        total_net += net

        created = order.get("created", "")
        if created:
            date_key = created[:10]
            daily_sales[date_key]["tickets"] += 1
            daily_sales[date_key]["gross"] += gross

    # Sort daily sales by date
    daily_sorted = [
        {"date": k, "tickets": v["tickets"], "gross": round(v["gross"], 2)}
        for k, v in sorted(daily_sales.items())
    ]

    avg_order = round(total_gross / active_orders, 2) if active_orders > 0 else 0.0

    print(f"    Revenue: ${total_gross:,.2f} gross, ${total_net:,.2f} net ({active_orders} orders)")

    return {
        "total_gross_revenue": round(total_gross, 2),
        "total_net_revenue": round(total_net, 2),
        "total_fees": round(total_fees, 2),
        "total_orders": active_orders,
        "avg_order_value": avg_order,
        "daily_sales": daily_sorted,
    }


def pull_attendees(token, event_id, event_name):
    """Pull attendee data and check-in status for an event."""
    attendees = paginate(token, f"/events/{event_id}/attendees/", key="attendees")

    total = 0
    checked_in = 0
    cancelled = 0
    refunded = 0
    by_ticket_class = defaultdict(lambda: {"total": 0, "checked_in": 0})

    attendee_details = []

    for att in attendees:
        status = att.get("status", "")
        profile = att.get("profile", {}) or {}
        attendee_details.append({
            "id": att.get("id"),
            "order_id": att.get("order_id"),
            "status": status,
            "cancelled": att.get("cancelled", False),
            "refunded": att.get("refunded", False),
            "checked_in": att.get("checked_in", False),
            "created": att.get("created"),
            "changed": att.get("changed"),
            "ticket_class_id": att.get("ticket_class_id"),
            "ticket_class_name": att.get("ticket_class_name", "Unknown"),
            "name": profile.get("name") or " ".join(
                part for part in [profile.get("first_name"), profile.get("last_name")] if part
            ),
            "email": profile.get("email") or att.get("email"),
        })
        if status == "Attending" or att.get("cancelled") is False:
            total += 1
            tc_name = att.get("ticket_class_name", "Unknown")
            by_ticket_class[tc_name]["total"] += 1

            if att.get("checked_in", False):
                checked_in += 1
                by_ticket_class[tc_name]["checked_in"] += 1
        if att.get("cancelled", False):
            cancelled += 1
        if att.get("refunded", False):
            refunded += 1

    no_show = total - checked_in
    attendance_rate = round((checked_in / total * 100), 1) if total > 0 else 0
    no_show_rate = round((no_show / total * 100), 1) if total > 0 else 0

    by_tc_list = []
    for name, data in by_ticket_class.items():
        rate = round((data["checked_in"] / data["total"] * 100), 1) if data["total"] > 0 else 0
        by_tc_list.append({
            "name": name,
            "total": data["total"],
            "checked_in": data["checked_in"],
            "rate": rate,
        })

    print(f"    Attendance: {checked_in}/{total} checked in ({attendance_rate}%)")

    return {
        "total_attendees": total,
        "checked_in": checked_in,
        "no_show": no_show,
        "cancelled": cancelled,
        "refunded": refunded,
        "attendance_rate": attendance_rate,
        "no_show_rate": no_show_rate,
        "by_ticket_class": by_tc_list,
        "attendee_details": attendee_details,
    }


# ── Main ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("IPN Analytics Dashboard — Eventbrite Data Pull")
    print("=" * 60)

    token = load_env()

    # Get org ID from env or auto-discover
    org_id = os.environ.get("EVENTBRITE_ORG_ID")
    org_name = ""
    if org_id:
        print(f"\nUsing org ID from .env: {org_id}")
    else:
        print("\nAuto-discovering organization...")
        org_id, org_name = discover_org_id(token)

    # Pull all events
    events = pull_events(token, org_id)

    # For each event, pull ticket classes, orders, and attendees
    total_revenue_all = 0.0
    total_tickets_all = 0
    active_count = 0
    upcoming_count = 0
    past_count = 0

    for evt in events:
        event_id = evt["id"]
        event_name = evt["name"]
        status = evt["status"]

        if status == "live":
            active_count += 1
        elif status in ("started", "ended", "completed"):
            past_count += 1
        elif status == "draft":
            upcoming_count += 1

        print(f"\n2. Processing: {event_name} ({status})")

        # Ticket classes
        try:
            ticket_classes, capacity, sold, sell_through = pull_ticket_classes(
                token, event_id, event_name
            )
            evt["ticket_classes"] = ticket_classes
            evt["capacity"] = capacity or evt.get("capacity", 0)
            total_tickets_all += sold
        except Exception as e:
            print(f"    WARNING: Could not pull ticket classes: {e}")
            evt["ticket_classes"] = []

        # Orders (skip for free-only events)
        if not evt.get("is_free", False):
            try:
                sales = pull_orders(token, event_id, event_name)
                evt["sales"] = sales
                evt["sales"]["total_tickets_sold"] = sold
                evt["sales"]["sell_through_rate"] = sell_through
                total_revenue_all += sales["total_gross_revenue"]
            except Exception as e:
                print(f"    WARNING: Could not pull orders: {e}")
                evt["sales"] = {"total_tickets_sold": sold, "sell_through_rate": sell_through,
                                "total_gross_revenue": 0, "total_net_revenue": 0,
                                "total_fees": 0, "total_orders": 0, "avg_order_value": 0,
                                "daily_sales": []}
        else:
            evt["sales"] = {"total_tickets_sold": sold, "sell_through_rate": sell_through,
                            "total_gross_revenue": 0, "total_net_revenue": 0,
                            "total_fees": 0, "total_orders": 0, "avg_order_value": 0,
                            "daily_sales": []}

        # Attendees
        try:
            attendance = pull_attendees(token, event_id, event_name)
            evt["attendance"] = attendance
        except Exception as e:
            print(f"    WARNING: Could not pull attendees: {e}")
            evt["attendance"] = {"total_attendees": 0, "checked_in": 0, "no_show": 0,
                                 "cancelled": 0, "refunded": 0, "attendance_rate": 0,
                                 "no_show_rate": 0, "by_ticket_class": []}

    # Build output
    output = {
        "organization": {
            "id": org_id,
            "name": org_name,
        },
        "events": events,
        "summary": {
            "total_events": len(events),
            "total_tickets_sold_all": total_tickets_all,
            "total_gross_revenue_all": round(total_revenue_all, 2),
            "active_events": active_count,
            "upcoming_events": upcoming_count,
            "past_events": past_count,
        },
        "pulled_at": datetime.now(timezone.utc).isoformat(),
    }

    save_json("eventbrite_events.json", output)

    # Save pull timestamp
    save_json("eventbrite_last_pull.json", {
        "last_pull": datetime.now(timezone.utc).isoformat(),
        "status": "success",
        "events_pulled": len(events),
        "total_revenue": round(total_revenue_all, 2),
    })

    print("\n" + "=" * 60)
    print(f"DONE! {len(events)} events pulled.")
    print(f"Total tickets sold: {total_tickets_all}")
    print(f"Total gross revenue: ${total_revenue_all:,.2f}")
    print("All Eventbrite data saved to: " + str(DATA_DIR))
    print("=" * 60)


if __name__ == "__main__":
    main()
