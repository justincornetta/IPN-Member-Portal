"""
IPN Analytics Dashboard — Google Analytics (GA4) Data Pull
Pulls website traffic, engagement, conversion funnels, and trend data
from the Google Analytics Data API (GA4).

Usage:
    python google_analytics_pull.py

Requires:
    - google-analytics-data library (pip install google-analytics-data)
    - GA4_PROPERTY_ID in ../.env or ../../workspace/.env
    - GOOGLE_SERVICE_ACCOUNT_KEY_PATH in ../.env (path to service account JSON key)

Output files (in ../data/):
    - website_stats.json       — all website metrics (overview, pages, devices,
                                  geo, acquisition, funnels, clicks, blog, trends)
    - website_last_pull.json   — timestamp of last successful pull
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Filter,
        FilterExpression,
        Metric,
        OrderBy,
        RunReportRequest,
    )
except ImportError:
    print("ERROR: google-analytics-data package not installed.")
    print("Install with: pip install google-analytics-data")
    sys.exit(1)

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
    """Load environment variables from .env file."""
    for env_path in ENV_PATHS:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ.setdefault(key.strip(), val.strip())

    property_id = os.environ.get("GA4_PROPERTY_ID")
    if not property_id:
        raise ValueError("GA4_PROPERTY_ID not found in .env")

    key_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY_PATH")
    if not key_path:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_KEY_PATH not found in .env")
    if not Path(key_path).exists():
        raise ValueError(f"Service account key file not found: {key_path}")

    # Set the credentials env var for the Google client library
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_path

    return property_id


def save_json(filename, data):
    """Save data to a JSON file in the data directory."""
    filepath = DATA_DIR / filename
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"  Saved: {filepath}")


def get_client():
    """Create the GA4 Data API client."""
    return BetaAnalyticsDataClient()


def run_report(client, property_id, dimensions=None, metrics=None,
               date_ranges=None, dimension_filter=None, order_bys=None,
               limit=None):
    """Run a GA4 report and return parsed rows."""
    request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=dimensions or [],
        metrics=metrics or [],
        date_ranges=date_ranges or [DateRange(start_date="30daysAgo", end_date="yesterday")],
        dimension_filter=dimension_filter,
        order_bys=order_bys or [],
        limit=limit or 0,
    )
    response = client.run_report(request)

    # Parse dimension and metric headers
    dim_headers = [h.name for h in response.dimension_headers]
    met_headers = [h.name for h in response.metric_headers]

    rows = []
    for row in response.rows:
        parsed = {}
        for i, dim in enumerate(row.dimension_values):
            parsed[dim_headers[i]] = dim.value
        for i, met in enumerate(row.metric_values):
            val = met.value
            # Convert numeric strings
            try:
                val = int(val)
            except ValueError:
                try:
                    val = round(float(val), 2)
                except ValueError:
                    pass
            parsed[met_headers[i]] = val
        rows.append(parsed)

    return rows


# ── Pull Functions ──────────────────────────────────────────────────

def pull_overview(client, property_id):
    """Pull 30-day overview with MoM comparison and new vs returning users."""
    print("\n1. Pulling overview (30-day snapshot + MoM)...")

    # Current period: last 30 days
    current = run_report(client, property_id,
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="screenPageViews"),
            Metric(name="bounceRate"),
            Metric(name="averageSessionDuration"),
            Metric(name="newUsers"),
        ],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
    )

    # Previous period: 60-31 days ago
    previous = run_report(client, property_id,
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="screenPageViews"),
            Metric(name="bounceRate"),
            Metric(name="averageSessionDuration"),
            Metric(name="newUsers"),
        ],
        date_ranges=[DateRange(start_date="60daysAgo", end_date="31daysAgo")],
    )

    # New vs returning
    new_returning = run_report(client, property_id,
        dimensions=[Dimension(name="newVsReturning")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
        ],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
    )

    cur = current[0] if current else {}
    prev = previous[0] if previous else {}

    def mom(cur_val, prev_val):
        if prev_val and prev_val > 0:
            return round(((cur_val - prev_val) / prev_val) * 100, 1)
        return 0

    overview = {
        "sessions_30d": cur.get("sessions", 0),
        "unique_visitors_30d": cur.get("activeUsers", 0),
        "pageviews_30d": cur.get("screenPageViews", 0),
        "bounce_rate": cur.get("bounceRate", 0),
        "avg_session_duration": cur.get("averageSessionDuration", 0),
        "new_users_30d": cur.get("newUsers", 0),
        "sessions_prev_30d": prev.get("sessions", 0),
        "unique_visitors_prev_30d": prev.get("activeUsers", 0),
        "sessions_mom_pct": mom(cur.get("sessions", 0), prev.get("sessions", 0)),
        "visitors_mom_pct": mom(cur.get("activeUsers", 0), prev.get("activeUsers", 0)),
        "new_vs_returning": {row.get("newVsReturning", "unknown"): {
            "sessions": row.get("sessions", 0),
            "users": row.get("activeUsers", 0),
        } for row in new_returning},
    }

    print(f"  Sessions (30d): {overview['sessions_30d']} ({overview['sessions_mom_pct']:+.1f}% MoM)")
    print(f"  Unique visitors: {overview['unique_visitors_30d']}")
    print(f"  Bounce rate: {overview['bounce_rate']:.1f}%")
    print(f"  Avg duration: {overview['avg_session_duration']:.1f}s")
    return overview


def pull_pages(client, property_id):
    """Pull top 20 pages by pageviews with per-page bounce rate."""
    print("\n2. Pulling top pages...")
    rows = run_report(client, property_id,
        dimensions=[Dimension(name="pagePath"), Dimension(name="pageTitle")],
        metrics=[
            Metric(name="screenPageViews"),
            Metric(name="activeUsers"),
            Metric(name="averageSessionDuration"),
            Metric(name="bounceRate"),
        ],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)],
        limit=20,
    )

    pages = [{
        "path": r["pagePath"],
        "title": r["pageTitle"],
        "pageviews": r["screenPageViews"],
        "users": r["activeUsers"],
        "avg_duration": r["averageSessionDuration"],
        "bounce_rate": r["bounceRate"],
    } for r in rows]

    for p in pages[:5]:
        print(f"  {p['path'][:40]:40s} {p['pageviews']:>6} views  {p['bounce_rate']:.1f}% bounce")
    if len(pages) > 5:
        print(f"  ... and {len(pages) - 5} more pages")
    return pages


def pull_devices(client, property_id):
    """Pull traffic by device category (desktop, mobile, tablet)."""
    print("\n3. Pulling device breakdown...")
    rows = run_report(client, property_id,
        dimensions=[Dimension(name="deviceCategory")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
        ],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
    )

    devices = [{
        "device": r["deviceCategory"],
        "sessions": r["sessions"],
        "users": r["activeUsers"],
    } for r in rows]

    for d in devices:
        print(f"  {d['device']:12s} {d['sessions']:>6} sessions  {d['users']:>6} users")
    return devices


def pull_geo(client, property_id):
    """Pull geographic breakdown (top 20 countries and cities)."""
    print("\n4. Pulling geographic data...")

    countries = run_report(client, property_id,
        dimensions=[Dimension(name="country")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=20,
    )

    cities = run_report(client, property_id,
        dimensions=[Dimension(name="city")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=20,
    )

    geo = {
        "countries": [{"country": r["country"], "sessions": r["sessions"], "users": r["activeUsers"]} for r in countries],
        "cities": [{"city": r["city"], "sessions": r["sessions"], "users": r["activeUsers"]} for r in cities],
    }

    for c in geo["countries"][:5]:
        print(f"  {c['country']:20s} {c['sessions']:>6} sessions")
    if len(geo["countries"]) > 5:
        print(f"  ... and {len(geo['countries']) - 5} more countries")
    return geo


def pull_acquisition(client, property_id):
    """Pull how people find the site (channels + sources)."""
    print("\n5. Pulling acquisition channels...")

    channels = run_report(client, property_id,
        dimensions=[Dimension(name="sessionDefaultChannelGroup")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
    )

    sources = run_report(client, property_id,
        dimensions=[Dimension(name="sessionSource"), Dimension(name="sessionMedium")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=20,
    )

    acquisition = {
        "channels": [{
            "channel": r["sessionDefaultChannelGroup"],
            "sessions": r["sessions"],
            "users": r["activeUsers"],
        } for r in channels],
        "sources": [{
            "source": r["sessionSource"],
            "medium": r["sessionMedium"],
            "sessions": r["sessions"],
            "users": r["activeUsers"],
        } for r in sources],
    }

    for ch in acquisition["channels"]:
        print(f"  {ch['channel']:20s} {ch['sessions']:>6} sessions  {ch['users']:>6} users")
    return acquisition


def pull_conversion_funnels(client, property_id):
    """Pull conversion metrics for key IPN pages."""
    print("\n6. Pulling conversion funnels...")

    key_pages = [
        "/become-a-member",
        "/donate",
        "/psychedelx",
        "/contact",
    ]

    funnels = {}
    for page_path in key_pages:
        rows = run_report(client, property_id,
            dimensions=[Dimension(name="pagePath")],
            metrics=[
                Metric(name="screenPageViews"),
                Metric(name="activeUsers"),
                Metric(name="bounceRate"),
                Metric(name="averageSessionDuration"),
            ],
            date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
            dimension_filter=FilterExpression(
                filter=Filter(
                    field_name="pagePath",
                    string_filter=Filter.StringFilter(
                        match_type=Filter.StringFilter.MatchType.CONTAINS,
                        value=page_path,
                    ),
                ),
            ),
        )

        if rows:
            total_views = sum(r.get("screenPageViews", 0) for r in rows)
            total_users = sum(r.get("activeUsers", 0) for r in rows)
            avg_bounce = rows[0].get("bounceRate", 0) if len(rows) == 1 else (
                sum(r.get("bounceRate", 0) for r in rows) / len(rows)
            )
            funnels[page_path] = {
                "pageviews": total_views,
                "users": total_users,
                "bounce_rate": round(avg_bounce, 1),
                "avg_duration": rows[0].get("averageSessionDuration", 0),
            }
            print(f"  {page_path:25s} {total_views:>6} views  {total_users:>6} users  {avg_bounce:.1f}% bounce")
        else:
            funnels[page_path] = {"pageviews": 0, "users": 0, "bounce_rate": 0, "avg_duration": 0}
            print(f"  {page_path:25s} No data")

    # Try to pull outbound click events for PsychedelX application link
    try:
        psychedelx_clicks = run_report(client, property_id,
            dimensions=[Dimension(name="linkUrl")],
            metrics=[Metric(name="eventCount")],
            date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
            dimension_filter=FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    string_filter=Filter.StringFilter(
                        match_type=Filter.StringFilter.MatchType.EXACT,
                        value="click",
                    ),
                ),
            ),
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True)],
            limit=20,
        )
        funnels["outbound_clicks"] = [{
            "url": r["linkUrl"],
            "clicks": r["eventCount"],
        } for r in psychedelx_clicks]
        print(f"  Outbound clicks: {len(psychedelx_clicks)} URLs tracked")
    except Exception as e:
        funnels["outbound_clicks"] = []
        print(f"  Outbound clicks: not available ({e})")

    return funnels


def pull_landing_pages(client, property_id):
    """Pull which pages visitors arrive on first."""
    print("\n7. Pulling landing pages...")
    rows = run_report(client, property_id,
        dimensions=[Dimension(name="landingPage")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="bounceRate"),
        ],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
        limit=20,
    )

    landing_pages = [{
        "page": r["landingPage"],
        "sessions": r["sessions"],
        "users": r["activeUsers"],
        "bounce_rate": r["bounceRate"],
    } for r in rows]

    for lp in landing_pages[:5]:
        print(f"  {lp['page'][:40]:40s} {lp['sessions']:>6} sessions  {lp['bounce_rate']:.1f}% bounce")
    return landing_pages


def pull_clicks(client, property_id):
    """Pull CTA and outbound click events."""
    print("\n8. Pulling click events...")

    clicks = {"outbound": [], "cta_events": []}

    # Outbound link clicks (GA4 enhanced measurement)
    try:
        outbound = run_report(client, property_id,
            dimensions=[Dimension(name="linkUrl"), Dimension(name="pagePath")],
            metrics=[Metric(name="eventCount")],
            date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
            dimension_filter=FilterExpression(
                filter=Filter(
                    field_name="eventName",
                    string_filter=Filter.StringFilter(
                        match_type=Filter.StringFilter.MatchType.EXACT,
                        value="click",
                    ),
                ),
            ),
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="eventCount"), desc=True)],
            limit=30,
        )
        clicks["outbound"] = [{
            "link_url": r["linkUrl"],
            "page": r["pagePath"],
            "clicks": r["eventCount"],
        } for r in outbound]
        print(f"  Outbound link clicks: {len(outbound)} tracked")
    except Exception as e:
        print(f"  Outbound clicks: not available ({e})")

    # Custom CTA click events (will be empty until configured on site)
    cta_event_names = ["cta_join_now", "cta_sign_up", "cta_donate", "cta_apply"]
    for event_name in cta_event_names:
        try:
            rows = run_report(client, property_id,
                dimensions=[Dimension(name="pagePath")],
                metrics=[Metric(name="eventCount")],
                date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
                dimension_filter=FilterExpression(
                    filter=Filter(
                        field_name="eventName",
                        string_filter=Filter.StringFilter(
                            match_type=Filter.StringFilter.MatchType.EXACT,
                            value=event_name,
                        ),
                    ),
                ),
            )
            if rows:
                total = sum(r.get("eventCount", 0) for r in rows)
                clicks["cta_events"].append({
                    "event": event_name,
                    "total_clicks": total,
                    "by_page": [{"page": r["pagePath"], "clicks": r["eventCount"]} for r in rows],
                })
                print(f"  {event_name}: {total} clicks")
        except Exception:
            pass  # Event not configured yet — skip silently

    if not clicks["cta_events"]:
        print("  CTA events: none configured yet (see SETUP.md for instructions)")

    return clicks


def pull_blog_performance(client, property_id):
    """Pull blog-specific metrics (pages matching /blog/*)."""
    print("\n9. Pulling blog performance...")
    rows = run_report(client, property_id,
        dimensions=[Dimension(name="pagePath"), Dimension(name="pageTitle")],
        metrics=[
            Metric(name="screenPageViews"),
            Metric(name="activeUsers"),
            Metric(name="averageSessionDuration"),
            Metric(name="bounceRate"),
        ],
        date_ranges=[DateRange(start_date="30daysAgo", end_date="yesterday")],
        dimension_filter=FilterExpression(
            filter=Filter(
                field_name="pagePath",
                string_filter=Filter.StringFilter(
                    match_type=Filter.StringFilter.MatchType.CONTAINS,
                    value="/blog",
                ),
            ),
        ),
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)],
        limit=20,
    )

    blog = [{
        "path": r["pagePath"],
        "title": r["pageTitle"],
        "pageviews": r["screenPageViews"],
        "users": r["activeUsers"],
        "avg_duration": r["averageSessionDuration"],
        "bounce_rate": r["bounceRate"],
    } for r in rows]

    total_views = sum(p["pageviews"] for p in blog)
    print(f"  Blog pages found: {len(blog)} ({total_views} total views)")
    for b in blog[:3]:
        print(f"    {b['title'][:50]:50s} {b['pageviews']:>5} views")
    return blog


def pull_monthly_trend(client, property_id):
    """Pull all available monthly trends for charting."""
    print("\n10. Pulling all-time monthly trends...")

    # Core monthly metrics
    core = run_report(client, property_id,
        dimensions=[Dimension(name="yearMonth")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="screenPageViews"),
            Metric(name="bounceRate"),
            Metric(name="averageSessionDuration"),
            Metric(name="newUsers"),
        ],
        date_ranges=[DateRange(start_date="2020-08-14", end_date="yesterday")],
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="yearMonth"))],
    )

    monthly = [{
        "month": r["yearMonth"],
        "sessions": r["sessions"],
        "users": r["activeUsers"],
        "pageviews": r["screenPageViews"],
        "bounce_rate": r["bounceRate"],
        "avg_duration": r["averageSessionDuration"],
        "new_users": r["newUsers"],
    } for r in core]

    # Monthly device breakdown
    devices_monthly = run_report(client, property_id,
        dimensions=[Dimension(name="yearMonth"), Dimension(name="deviceCategory")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="2020-08-14", end_date="yesterday")],
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="yearMonth"))],
    )

    device_trend = {}
    for r in devices_monthly:
        month = r["yearMonth"]
        if month not in device_trend:
            device_trend[month] = {}
        device_trend[month][r["deviceCategory"]] = {
            "sessions": r["sessions"],
            "users": r["activeUsers"],
        }

    # Monthly acquisition breakdown
    acq_monthly = run_report(client, property_id,
        dimensions=[Dimension(name="yearMonth"), Dimension(name="sessionDefaultChannelGroup")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="2020-08-14", end_date="yesterday")],
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="yearMonth"))],
    )

    acq_trend = {}
    for r in acq_monthly:
        month = r["yearMonth"]
        if month not in acq_trend:
            acq_trend[month] = {}
        acq_trend[month][r["sessionDefaultChannelGroup"]] = {
            "sessions": r["sessions"],
            "users": r["activeUsers"],
        }

    # Monthly new vs returning
    nvr_monthly = run_report(client, property_id,
        dimensions=[Dimension(name="yearMonth"), Dimension(name="newVsReturning")],
        metrics=[Metric(name="sessions"), Metric(name="activeUsers")],
        date_ranges=[DateRange(start_date="2020-08-14", end_date="yesterday")],
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="yearMonth"))],
    )

    nvr_trend = {}
    for r in nvr_monthly:
        month = r["yearMonth"]
        if month not in nvr_trend:
            nvr_trend[month] = {}
        nvr_trend[month][r["newVsReturning"]] = {
            "sessions": r["sessions"],
            "users": r["activeUsers"],
        }

    # Daily core metrics (last 90 days for day/week granularity)
    print("  Pulling daily data (last 90 days)...")
    daily_core = run_report(client, property_id,
        dimensions=[Dimension(name="date")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="screenPageViews"),
            Metric(name="bounceRate"),
            Metric(name="averageSessionDuration"),
            Metric(name="newUsers"),
        ],
        date_ranges=[DateRange(start_date="90daysAgo", end_date="yesterday")],
        order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="date"))],
    )

    daily = [{
        "date": r["date"],
        "sessions": r["sessions"],
        "users": r["activeUsers"],
        "pageviews": r["screenPageViews"],
        "bounce_rate": r["bounceRate"],
        "avg_duration": r["averageSessionDuration"],
        "new_users": r["newUsers"],
    } for r in daily_core]

    trends = {
        "monthly": monthly,
        "daily": daily,
        "devices_by_month": device_trend,
        "acquisition_by_month": acq_trend,
        "new_vs_returning_by_month": nvr_trend,
    }

    print(f"  Months of data: {len(monthly)}")
    print(f"  Days of data: {len(daily)}")
    for m in monthly[-3:]:
        print(f"    {m['month']}: {m['sessions']} sessions, {m['users']} users, {m['bounce_rate']:.1f}% bounce")

    return trends


# ── Main ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("IPN Analytics Dashboard — Google Analytics (GA4) Data Pull")
    print("=" * 60)

    property_id = load_env()
    client = get_client()

    overview = pull_overview(client, property_id)
    pages = pull_pages(client, property_id)
    devices = pull_devices(client, property_id)
    geo = pull_geo(client, property_id)
    acquisition = pull_acquisition(client, property_id)
    funnels = pull_conversion_funnels(client, property_id)
    landing_pages = pull_landing_pages(client, property_id)
    clicks = pull_clicks(client, property_id)
    blog = pull_blog_performance(client, property_id)
    trends = pull_monthly_trend(client, property_id)

    # Save all website stats
    website_stats = {
        "overview": overview,
        "pages": pages,
        "devices": devices,
        "geo": geo,
        "acquisition": acquisition,
        "funnels": funnels,
        "landing_pages": landing_pages,
        "clicks": clicks,
        "blog": blog,
        "monthly_trend": trends,
        "pulled_at": datetime.now(timezone.utc).isoformat(),
    }
    save_json("website_stats.json", website_stats)

    # Save pull timestamp
    save_json("website_last_pull.json", {
        "last_pull": datetime.now(timezone.utc).isoformat(),
        "status": "success",
        "sessions_30d": overview.get("sessions_30d", 0),
        "unique_visitors_30d": overview.get("unique_visitors_30d", 0),
    })

    print("\n" + "=" * 60)
    print("DONE! All website analytics saved to: " + str(DATA_DIR))
    print("=" * 60)


if __name__ == "__main__":
    main()
