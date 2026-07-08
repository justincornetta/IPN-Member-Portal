"""
IPN Analytics Dashboard — Squarespace Commerce Data Pull
Pulls donation and order data from the Squarespace REST API v1.
Saves data to JSON files in the data/ folder for the dashboard to consume.

Usage:
    python squarespace_pull.py

Requires:
    - requests library (pip install requests)
    - SQUARESPACE_API_KEY in ../.env or ../../workspace/.env

Output files (in ../data/):
    - donations_stats.json      — donation totals, averages, monthly trend
    - donations_last_pull.json  — timestamp of last successful pull
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

BASE_URL = "https://api.squarespace.com"


def load_env():
    """Load API key from .env file."""
    for env_path in ENV_PATHS:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ.setdefault(key.strip(), val.strip())

    api_key = os.environ.get("SQUARESPACE_API_KEY")
    if not api_key:
        raise ValueError("SQUARESPACE_API_KEY not found in .env")
    return api_key


def save_json(filename, data):
    """Save data to a JSON file in the data directory."""
    filepath = DATA_DIR / filename
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved: {filepath}")


def api_get(api_key, endpoint, params=None):
    """Make a GET request to the Squarespace API."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "IPN-Analytics-Dashboard/1.0",
    }
    r = requests.get(f"{BASE_URL}{endpoint}", headers=headers, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


# ── Pull Functions ──────────────────────────────────────────────────

def pull_orders(api_key):
    """Pull all orders/donations with pagination."""
    print("\n1. Pulling orders/donations...")
    all_orders = []
    cursor = None

    while True:
        params = {}
        if cursor:
            params["cursor"] = cursor

        data = api_get(api_key, "/1.0/commerce/orders", params=params)
        orders = data.get("result", [])

        if not orders:
            break

        for order in orders:
            grand_total = order.get("grandTotal", {})
            created = order.get("createdOn", "")

            all_orders.append({
                "id": order.get("id"),
                "order_number": order.get("orderNumber"),
                "created_on": created,
                "amount": float(grand_total.get("value", "0")),
                "currency": grand_total.get("currency", "USD"),
                "fulfillment_status": order.get("fulfillmentStatus", ""),
                "line_items_count": len(order.get("lineItems", [])),
            })

        print(f"  Fetched {len(orders)} orders (total so far: {len(all_orders)})")

        # Check for pagination cursor
        pagination = data.get("pagination", {})
        if pagination.get("hasNextPage"):
            cursor = pagination.get("nextPageCursor")
        else:
            break

    print(f"  Total orders pulled: {len(all_orders)}")
    return all_orders


def pull_donation_summary(orders):
    """Aggregate donation metrics from order data."""
    print("\n2. Building donation summary...")

    if not orders:
        print("  No orders found.")
        return {
            "total_raised": 0,
            "total_raised_30d": 0,
            "donation_count": 0,
            "donation_count_30d": 0,
            "average_donation": 0,
            "donation_count_prev_30d": 0,
            "count_mom_pct": 0,
            "amount_mom_pct": 0,
            "monthly_trend": [],
        }

    now = datetime.now(timezone.utc)

    # Calculate totals
    total_raised = sum(o["amount"] for o in orders)
    donation_count = len(orders)
    average_donation = round(total_raised / donation_count, 2) if donation_count > 0 else 0

    # 30-day metrics
    thirty_days_ago = now.timestamp() - (30 * 86400)
    sixty_days_ago = now.timestamp() - (60 * 86400)

    recent_orders = []
    prev_orders = []
    for o in orders:
        try:
            created = datetime.fromisoformat(o["created_on"].replace("Z", "+00:00"))
            ts = created.timestamp()
            if ts >= thirty_days_ago:
                recent_orders.append(o)
            elif ts >= sixty_days_ago:
                prev_orders.append(o)
        except (ValueError, AttributeError):
            continue

    total_raised_30d = sum(o["amount"] for o in recent_orders)
    donation_count_30d = len(recent_orders)
    total_raised_prev_30d = sum(o["amount"] for o in prev_orders)
    donation_count_prev_30d = len(prev_orders)

    # MoM calculations
    def mom(current, previous):
        if previous and previous > 0:
            return round(((current - previous) / previous) * 100, 1)
        return 0

    count_mom = mom(donation_count_30d, donation_count_prev_30d)
    amount_mom = mom(total_raised_30d, total_raised_prev_30d)

    # Monthly trend (12 months)
    monthly = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for o in orders:
        try:
            created = datetime.fromisoformat(o["created_on"].replace("Z", "+00:00"))
            month_key = created.strftime("%Y-%m")
            monthly[month_key]["count"] += 1
            monthly[month_key]["amount"] += o["amount"]
        except (ValueError, AttributeError):
            continue

    monthly_trend = []
    for month in sorted(monthly.keys())[-12:]:
        m = monthly[month]
        monthly_trend.append({
            "month": month,
            "count": m["count"],
            "amount": round(m["amount"], 2),
            "average": round(m["amount"] / m["count"], 2) if m["count"] > 0 else 0,
        })

    summary = {
        "total_raised": round(total_raised, 2),
        "total_raised_30d": round(total_raised_30d, 2),
        "donation_count": donation_count,
        "donation_count_30d": donation_count_30d,
        "average_donation": average_donation,
        "donation_count_prev_30d": donation_count_prev_30d,
        "count_mom_pct": count_mom,
        "amount_mom_pct": amount_mom,
        "monthly_trend": monthly_trend,
    }

    print(f"  Total raised: ${total_raised:,.2f} ({donation_count} donations)")
    print(f"  Last 30 days: ${total_raised_30d:,.2f} ({donation_count_30d} donations, {count_mom:+.1f}% MoM)")
    print(f"  Average donation: ${average_donation:,.2f}")
    print(f"  Monthly trend: {len(monthly_trend)} months")
    for m in monthly_trend[-3:]:
        print(f"    {m['month']}: {m['count']} donations, ${m['amount']:,.2f}")

    return summary


# ── Main ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("IPN Analytics Dashboard — Squarespace Commerce Data Pull")
    print("=" * 60)

    api_key = load_env()
    orders = pull_orders(api_key)
    summary = pull_donation_summary(orders)

    # Save donation stats
    donations_stats = {
        "summary": summary,
        "orders": orders,
        "pulled_at": datetime.now(timezone.utc).isoformat(),
    }
    save_json("donations_stats.json", donations_stats)

    # Save pull timestamp
    save_json("donations_last_pull.json", {
        "last_pull": datetime.now(timezone.utc).isoformat(),
        "status": "success",
        "total_raised": summary["total_raised"],
        "donation_count": summary["donation_count"],
    })

    print("\n" + "=" * 60)
    print("DONE! All donation data saved to: " + str(DATA_DIR))
    print("=" * 60)


if __name__ == "__main__":
    main()
