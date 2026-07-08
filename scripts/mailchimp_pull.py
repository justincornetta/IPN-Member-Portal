"""
IPN Analytics Dashboard — Mailchimp Data Pull
Pulls subscriber stats, list growth, and campaign performance from Mailchimp API.
Saves data to JSON files in the data/ folder for the dashboard to consume.

Usage:
    python mailchimp_pull.py

Requires:
    - requests library (pip install requests)
    - MAILCHIMP_API_KEY in ../.env or ../../workspace/.env

Output files (in ../data/):
    - mailchimp_account.json    — account-level stats
    - mailchimp_lists.json      — all lists with subscriber counts
    - mailchimp_growth.json     — monthly subscriber growth history
    - mailchimp_campaigns.json  — recent campaign performance
    - mailchimp_last_pull.json  — timestamp of last successful pull
"""

import requests
import json
import os
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

    api_key = os.environ.get("MAILCHIMP_API_KEY")
    if not api_key:
        raise ValueError("MAILCHIMP_API_KEY not found in .env")
    return api_key

def get_client(api_key):
    """Create a simple API client."""
    server = api_key.split("-")[-1]
    base_url = f"https://{server}.api.mailchimp.com/3.0"
    auth = ("anystring", api_key)
    return base_url, auth

def api_get(base_url, auth, endpoint, params=None):
    """Make a GET request to the Mailchimp API."""
    r = requests.get(f"{base_url}{endpoint}", auth=auth, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def save_json(filename, data):
    """Save data to a JSON file in the data directory."""
    filepath = DATA_DIR / filename
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved: {filepath}")

# ── Data Pull Functions ─────────────────────────────────────────────

def pull_account_info(base_url, auth):
    """Pull account-level information."""
    print("\n1. Pulling account info...")
    data = api_get(base_url, auth, "/")
    account = {
        "account_name": data.get("account_name"),
        "email": data.get("email"),
        "total_subscribers": data.get("total_subscribers"),
        "industry_stats": data.get("industry_stats", {}),
        "pulled_at": datetime.now(timezone.utc).isoformat(),
    }
    save_json("mailchimp_account.json", account)
    print(f"  Account: {account['account_name']}")
    print(f"  Total subscribers: {account['total_subscribers']}")
    return account

def pull_lists(base_url, auth):
    """Pull all audience lists with subscriber counts."""
    print("\n2. Pulling audience lists...")
    data = api_get(base_url, auth, "/lists", params={"count": 50})
    lists = []
    for lst in data.get("lists", []):
        stats = lst.get("stats", {})
        lists.append({
            "id": lst["id"],
            "name": lst["name"],
            "member_count": stats.get("member_count", 0),
            "unsubscribe_count": stats.get("unsubscribe_count", 0),
            "open_rate": stats.get("open_rate", 0),
            "click_rate": stats.get("click_rate", 0),
            "last_sub_date": stats.get("last_sub_date"),
            "campaign_count": stats.get("campaign_count", 0),
        })
        print(f"  List: {lst['name']} — {stats.get('member_count', 0)} members")

    save_json("mailchimp_lists.json", {
        "lists": lists,
        "total_lists": len(lists),
        "pulled_at": datetime.now(timezone.utc).isoformat(),
    })
    return lists

def pull_growth_history(base_url, auth, lists):
    """Pull monthly subscriber growth for each list."""
    print("\n3. Pulling growth history...")
    all_growth = {}
    for lst in lists:
        list_id = lst["id"]
        data = api_get(base_url, auth, f"/lists/{list_id}/growth-history", params={"count": 12})
        history = []
        for item in data.get("history", []):
            history.append({
                "month": item.get("month"),
                "existing": item.get("existing", 0),
                "imports": item.get("imports", 0),
                "optins": item.get("optins", 0),
            })
        all_growth[lst["name"]] = {
            "list_id": list_id,
            "history": sorted(history, key=lambda x: x["month"]),
        }
        print(f"  {lst['name']}: {len(history)} months of history")

    save_json("mailchimp_growth.json", {
        "growth": all_growth,
        "pulled_at": datetime.now(timezone.utc).isoformat(),
    })
    return all_growth

def pull_campaigns(base_url, auth):
    """Pull ALL campaign performance data (paginated, up to 1000)."""
    print("\n4. Pulling ALL campaign performance (paginated)...")
    campaigns = []
    offset = 0
    page_size = 100  # max per request

    while True:
        print(f"  Fetching campaigns {offset+1}–{offset+page_size}...")
        data = api_get(base_url, auth, "/campaigns", params={
            "count": page_size,
            "offset": offset,
            "sort_field": "send_time",
            "sort_dir": "DESC",
            "status": "sent",
        })
        batch = data.get("campaigns", [])
        if not batch:
            break

        for c in batch:
            report = c.get("report_summary", {})
            recipients = c.get("recipients", {})
            settings = c.get("settings", {})
            campaigns.append({
                "id": c.get("id"),
                "title": settings.get("title", "Untitled"),
                "subject": settings.get("subject_line", ""),
                "send_time": c.get("send_time"),
                "list_name": recipients.get("list_name", ""),
                "recipient_count": recipients.get("recipient_count", 0),
                "emails_sent": c.get("emails_sent", 0),
                "opens": report.get("opens", 0),
                "unique_opens": report.get("unique_opens", 0),
                "open_rate": report.get("open_rate", 0),
                "clicks": report.get("clicks", 0),
                "click_rate": report.get("click_rate", 0),
                "unsubscribed": report.get("unsubscribed", 0),
                "bounce_rate": report.get("bounce_rate", 0),
                # Populated below from /reports/{id}. MPP = Apple Mail Privacy
                # Protection; report_summary doesn't include these fields.
                "proxy_excluded_open_rate": None,
                "proxy_excluded_unique_opens": None,
                "unique_subscriber_clicks": None,
            })

        print(f"    Got {len(batch)} campaigns (total so far: {len(campaigns)})")

        if len(batch) < page_size:
            break  # no more pages

        offset += page_size

    # Print summary of all campaigns
    print(f"\n  All {len(campaigns)} campaigns pulled:")
    for c in campaigns[:10]:
        open_pct = round(c["open_rate"] * 100, 1)
        click_pct = round(c["click_rate"] * 100, 1)
        print(f"    {c['title'][:40]:40s}  Open: {open_pct}%  Click: {click_pct}%")
    if len(campaigns) > 10:
        print(f"    ... and {len(campaigns) - 10} more")

    # Pull full report for each campaign to get MPP-filtered open rate and
    # the real unsubscribed count (report_summary on /campaigns does not
    # include either). This runs before monthly aggregation so the totals
    # use the corrected values.
    print(f"\n5. Pulling full /reports/{{id}} for {len(campaigns)} campaigns (MPP-filtered opens + unsubs)...")
    for i, c in enumerate(campaigns):
        cid = c.get("id")
        if not cid:
            continue
        try:
            rep = api_get(base_url, auth, f"/reports/{cid}")
            opens_obj = rep.get("opens", {}) or {}
            clicks_obj = rep.get("clicks", {}) or {}
            c["proxy_excluded_open_rate"] = opens_obj.get("proxy_excluded_open_rate")
            c["proxy_excluded_unique_opens"] = opens_obj.get("proxy_excluded_unique_opens")
            c["unique_subscriber_clicks"] = clicks_obj.get("unique_subscriber_clicks")
            if rep.get("unsubscribed") is not None:
                c["unsubscribed"] = rep.get("unsubscribed")
        except Exception:
            pass
        if (i + 1) % 20 == 0:
            print(f"    Processed {i + 1}/{len(campaigns)}...")
    print(f"    Done — full reports pulled for all campaigns")

    # Also build monthly aggregates for historical charting
    monthly = {}
    for c in campaigns:
        send_time = c.get("send_time", "")
        if send_time:
            month_key = send_time[:7]  # YYYY-MM
            if month_key not in monthly:
                monthly[month_key] = {
                    "month": month_key,
                    "campaigns_sent": 0,
                    "total_sent": 0,
                    "total_opens": 0,
                    "total_clicks": 0,
                    "total_unsubscribed": 0,
                }
            monthly[month_key]["campaigns_sent"] += 1
            monthly[month_key]["total_sent"] += c["emails_sent"]
            opens_for_month = c.get("proxy_excluded_unique_opens")
            if opens_for_month is None:
                opens_for_month = c["unique_opens"]
            monthly[month_key]["total_opens"] += opens_for_month
            clicks_for_month = c.get("unique_subscriber_clicks")
            if clicks_for_month is None:
                clicks_for_month = c["clicks"]
            monthly[month_key]["total_clicks"] += clicks_for_month
            monthly[month_key]["total_unsubscribed"] += c["unsubscribed"]

    # Calculate rates per month
    monthly_list = []
    for mk in sorted(monthly.keys()):
        m = monthly[mk]
        m["open_rate"] = round(m["total_opens"] / m["total_sent"] * 100, 1) if m["total_sent"] > 0 else 0
        m["click_rate"] = round(m["total_clicks"] / m["total_sent"] * 100, 1) if m["total_sent"] > 0 else 0
        monthly_list.append(m)

    print(f"\n  Monthly aggregates:")
    for m in monthly_list:
        print(f"    {m['month']}: {m['campaigns_sent']} campaigns, {m['open_rate']}% open, {m['click_rate']}% click")

    # Pull click details for each campaign
    print(f"\n6. Pulling click details for {len(campaigns)} campaigns...")
    for i, c in enumerate(campaigns):
        cid = c.get("id")
        if not cid or c.get("clicks", 0) == 0:
            c["click_detail"] = []
            continue
        try:
            detail = api_get(base_url, auth, f"/reports/{cid}/click-details",
                             params={"count": 50})
            urls = []
            for u in detail.get("urls_clicked", []):
                urls.append({
                    "url": u.get("url", ""),
                    "clicks": u.get("total_clicks", 0),
                    "unique": u.get("unique_clicks", 0),
                    "pct": round(u.get("click_percentage", 0) * 100, 1),
                })
            urls.sort(key=lambda x: x["clicks"], reverse=True)
            c["click_detail"] = urls
        except Exception as e:
            c["click_detail"] = []
        if (i + 1) % 20 == 0:
            print(f"    Processed {i + 1}/{len(campaigns)}...")
    print(f"    Done — click details pulled for all campaigns")

    save_json("mailchimp_campaigns.json", {
        "campaigns": campaigns,
        "total_campaigns": len(campaigns),
        "monthly_aggregates": monthly_list,
        "pulled_at": datetime.now(timezone.utc).isoformat(),
    })
    return campaigns

# ── Main ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("IPN Analytics Dashboard — Mailchimp Data Pull")
    print("=" * 60)

    api_key = load_env()
    base_url, auth = get_client(api_key)

    account = pull_account_info(base_url, auth)
    lists = pull_lists(base_url, auth)
    growth = pull_growth_history(base_url, auth, lists)
    campaigns = pull_campaigns(base_url, auth)

    # Save pull timestamp
    save_json("mailchimp_last_pull.json", {
        "last_pull": datetime.now(timezone.utc).isoformat(),
        "status": "success",
        "total_subscribers": account.get("total_subscribers"),
        "campaigns_pulled": len(campaigns),
    })

    print("\n" + "=" * 60)
    print("DONE! All Mailchimp data saved to: " + str(DATA_DIR))
    print("=" * 60)

if __name__ == "__main__":
    main()
