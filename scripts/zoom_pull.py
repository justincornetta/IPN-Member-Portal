#!/usr/bin/env python3
"""
IPN Analytics Dashboard — Zoom Data Pull
Pulls meeting and webinar data from Zoom via Server-to-Server OAuth.

Usage:
    python3 scripts/zoom_pull.py

Requires (in .env):
    - ZOOM_ACCOUNT_ID
    - ZOOM_CLIENT_ID
    - ZOOM_CLIENT_SECRET

Output files (in ../data/):
    - zoom_stats.json         — summary KPIs, monthly trends, recent events
    - zoom_events.json        — detailed per-event data with participant arrays
    - zoom_last_pull.json     — timestamp + status of last pull
"""

import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library not found. Install with: pip3 install requests")
    sys.exit(1)


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
CONFIG_PATH = DATA_DIR / "zoom_event_config.json"
ENV_PATHS = [
    PROJECT_DIR / ".env",
    PROJECT_DIR / ".env.local",
    PROJECT_DIR.parent / "workspace" / ".env",
    Path.home() / ".openclaw" / "workspace" / ".env",
]

ZOOM_AUTH_URL = "https://zoom.us/oauth/token"
ZOOM_API_BASE = "https://api.zoom.us/v2"

# Cached access token
_access_token = None
_token_expires_at = 0


def load_env():
    """Load variables from the first available .env file."""
    for env_path in ENV_PATHS:
        if env_path.exists():
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, val = line.partition("=")
                        os.environ.setdefault(key.strip(), val.strip())
            return env_path
    return None


def save_json(filename, data):
    DATA_DIR.mkdir(exist_ok=True)
    out_path = DATA_DIR / filename
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Saved: {out_path}")


def load_config():
    """Load event classification config."""
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {
        "programs": {
            "IPN Labs": ["IPN Labs"],
            "PsychedelX": ["PsychedelX"],
        },
        "public_keywords": ["Seminar", "Roundtable", "Talk", "Workshop", "Lecture", "Panel"],
        "public_min_participants": 15,
        "overrides": {},
    }


def get_access_token():
    """Get a Server-to-Server OAuth access token (cached for ~55 min)."""
    global _access_token, _token_expires_at

    if _access_token and time.time() < _token_expires_at:
        return _access_token

    account_id = os.environ.get("ZOOM_ACCOUNT_ID", "").strip()
    client_id = os.environ.get("ZOOM_CLIENT_ID", "").strip()
    client_secret = os.environ.get("ZOOM_CLIENT_SECRET", "").strip()

    if not all([account_id, client_id, client_secret]):
        raise RuntimeError("Missing ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, or ZOOM_CLIENT_SECRET in .env")

    response = requests.post(
        ZOOM_AUTH_URL,
        auth=(client_id, client_secret),
        data={"grant_type": "account_credentials", "account_id": account_id},
        timeout=30,
    )

    if response.status_code != 200:
        raise RuntimeError(f"Zoom OAuth error {response.status_code}: {response.text[:400]}")

    token_data = response.json()
    _access_token = token_data["access_token"]
    _token_expires_at = time.time() + token_data.get("expires_in", 3600) - 300  # refresh 5 min early
    return _access_token


def api_get(endpoint, params=None):
    """GET request to Zoom API with auto-retry on 401."""
    token = get_access_token()
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(f"{ZOOM_API_BASE}{endpoint}", headers=headers, params=params, timeout=30)

    if response.status_code == 401:
        global _access_token, _token_expires_at
        _access_token = None
        _token_expires_at = 0
        token = get_access_token()
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{ZOOM_API_BASE}{endpoint}", headers=headers, params=params, timeout=30)

    if response.status_code == 429:
        retry_after = int(response.headers.get("Retry-After", 5))
        print(f"  Rate limited. Waiting {retry_after}s...")
        time.sleep(retry_after)
        return api_get(endpoint, params)

    if response.status_code == 404:
        return None

    if response.status_code != 200:
        detail = response.text[:400]
        raise RuntimeError(f"Zoom API error {response.status_code} for {endpoint}: {detail}")

    return response.json()


def api_get_all_pages(endpoint, data_key, params=None):
    """Paginate through all pages and collect items under data_key."""
    params = dict(params or {})
    params.setdefault("page_size", 300)
    all_items = []

    while True:
        data = api_get(endpoint, params)
        if data is None:
            break

        items = data.get(data_key, [])
        all_items.extend(items)

        next_token = data.get("next_page_token", "")
        if not next_token:
            break
        params["next_page_token"] = next_token

    return all_items


def discover_users():
    """List all users on the Zoom account."""
    users = api_get_all_pages("/users", "users", {"status": "active"})
    print(f"  Found {len(users)} active user(s)")
    return users


def detect_webinar_addon(user_id):
    """Check if the account has the Webinar add-on."""
    try:
        data = api_get(f"/users/{user_id}/webinars", {"page_size": 1, "type": "past"})
        if data is None:
            return False
        # If we get a valid response (even empty), webinars are enabled
        return True
    except RuntimeError as e:
        # Zoom returns 400 with code 200 when webinar plan is missing
        if "Webinar plan is missing" in str(e) or "code\":200" in str(e):
            return False
        raise


def pull_past_meetings(user_id):
    """Pull past meetings from report endpoint (richer data, ~12 month history)."""
    # Reports API requires date range, max 1 month at a time
    all_meetings = []
    end_date = datetime.now(timezone.utc).date()
    # Zoom report API only allows last 6 months
    start_date = end_date - timedelta(days=180)

    current_start = start_date
    while current_start < end_date:
        current_end = min(current_start + timedelta(days=30), end_date)
        params = {
            "from": current_start.isoformat(),
            "to": current_end.isoformat(),
            "page_size": 300,
        }
        meetings = api_get_all_pages(f"/report/users/{user_id}/meetings", "meetings", params)
        all_meetings.extend(meetings)
        current_start = current_end + timedelta(days=1)

    print(f"  Found {len(all_meetings)} past meetings for user {user_id}")
    return all_meetings


def pull_past_webinars(user_id):
    """Pull past webinars."""
    webinars = api_get_all_pages(f"/users/{user_id}/webinars", "webinars", {"type": "past", "page_size": 300})
    print(f"  Found {len(webinars)} past webinars for user {user_id}")
    return webinars


def pull_scheduled_meetings(user_id):
    """Pull upcoming/scheduled meetings (returns next instance for recurring series)."""
    meetings = api_get_all_pages(f"/users/{user_id}/meetings", "meetings", {"type": "scheduled", "page_size": 300})
    print(f"  Found {len(meetings)} scheduled meetings for user {user_id}")
    return meetings


def pull_participants(event_type, event_id):
    """Pull participant list with join/leave times from report endpoint."""
    if event_type == "webinar":
        endpoint = f"/report/webinars/{event_id}/participants"
    else:
        endpoint = f"/report/meetings/{event_id}/participants"

    participants = api_get_all_pages(endpoint, "participants", {"page_size": 300})
    return participants


def pull_webinar_registrants(webinar_id):
    """Pull webinar registrants for attendance rate calculation."""
    return api_get_all_pages(f"/webinars/{webinar_id}/registrants", "registrants", {"page_size": 300})


def pull_meeting_registrants(meeting_id):
    """Pull registrants for a meeting that has registration enabled.

    Zoom returns HTTP 400 ("registration not required") for meetings without
    registration — treat that as no data, not an error.
    """
    try:
        return api_get_all_pages(f"/meetings/{meeting_id}/registrants", "registrants", {"page_size": 300})
    except RuntimeError as e:
        msg = str(e)
        if "400" in msg or "registration" in msg.lower():
            return []
        raise


def pull_webinar_absentees(webinar_id):
    """Pull registered attendees who did not show up."""
    data = api_get(f"/past_webinars/{webinar_id}/absentees", {"page_size": 300})
    if data is None:
        return []
    return data.get("registrants", [])


def pull_webinar_qa(webinar_id):
    """Pull Q&A report for a webinar (nice-to-have)."""
    data = api_get(f"/report/webinars/{webinar_id}/qa")
    if data is None:
        return []
    return data.get("questions", [])


def parse_zoom_datetime(ts):
    """Parse Zoom datetime string to timezone-aware datetime."""
    if not ts:
        return None
    ts = ts.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(ts)
    except (ValueError, TypeError):
        return None


def compute_retention(participants, event_duration_min):
    """Compute retention metrics from participant join/leave data."""
    if not participants or not event_duration_min or event_duration_min <= 0:
        return {
            "avg_duration_min": 0,
            "avg_retention_pct": 0,
            "median_retention_pct": 0,
            "retention_curve": {"25pct": 0, "50pct": 0, "75pct": 0, "100pct": 0},
            "drop_off_label": "unknown",
            "peak_concurrent": 0,
        }

    durations = []
    join_leave_events = []

    for p in participants:
        # Zoom provides duration in seconds
        dur_sec = p.get("duration", 0)
        if isinstance(dur_sec, str):
            try:
                dur_sec = int(dur_sec)
            except (ValueError, TypeError):
                dur_sec = 0

        dur_min = dur_sec / 60
        durations.append(dur_min)

        join_time = parse_zoom_datetime(p.get("join_time"))
        leave_time = parse_zoom_datetime(p.get("leave_time"))
        if join_time and leave_time:
            join_leave_events.append((join_time, leave_time))

    if not durations:
        return {
            "avg_duration_min": 0,
            "avg_retention_pct": 0,
            "median_retention_pct": 0,
            "retention_curve": {"25pct": 0, "50pct": 0, "75pct": 0, "100pct": 0},
            "drop_off_label": "unknown",
            "peak_concurrent": 0,
        }

    avg_dur = sum(durations) / len(durations)
    retention_pcts = sorted([min(d / event_duration_min * 100, 100) for d in durations])
    avg_ret = sum(retention_pcts) / len(retention_pcts)
    median_ret = retention_pcts[len(retention_pcts) // 2]

    # Retention curve: % of attendees still present at each quartile of event duration
    total = len(retention_pcts)
    curve = {
        "25pct": round(sum(1 for r in retention_pcts if r >= 25) / total * 100, 1),
        "50pct": round(sum(1 for r in retention_pcts if r >= 50) / total * 100, 1),
        "75pct": round(sum(1 for r in retention_pcts if r >= 75) / total * 100, 1),
        "100pct": round(sum(1 for r in retention_pcts if r >= 100) / total * 100, 1),
    }

    # Drop-off label based on where the biggest drop happens
    drops = [
        ("early", 100 - curve["25pct"]),
        ("mid", curve["25pct"] - curve["50pct"]),
        ("late", curve["50pct"] - curve["75pct"]),
    ]
    max_drop = max(drops, key=lambda x: x[1])
    if max_drop[1] < 15:
        drop_label = "minimal"
    else:
        drop_label = max_drop[0]

    # Peak concurrent attendees
    peak_concurrent = 0
    if join_leave_events:
        time_points = []
        for join_t, leave_t in join_leave_events:
            time_points.append((join_t, 1))
            time_points.append((leave_t, -1))
        time_points.sort(key=lambda x: x[0])
        current = 0
        for _, change in time_points:
            current += change
            peak_concurrent = max(peak_concurrent, current)

    return {
        "avg_duration_min": round(avg_dur, 1),
        "avg_retention_pct": round(avg_ret, 1),
        "median_retention_pct": round(median_ret, 1),
        "retention_curve": curve,
        "drop_off_label": drop_label,
        "peak_concurrent": peak_concurrent,
    }


def classify_event(topic, event_type, unique_participants, event_id, config):
    """Classify an event by program and type (public/internal)."""
    overrides = config.get("overrides", {})

    topic_str = topic or ""
    topic_lower = topic_str.lower()

    # Detect program
    program = "Other"
    for prog_name, keywords in config.get("programs", {}).items():
        for kw in keywords:
            if kw.lower() in topic_lower:
                program = prog_name
                break
        if program != "Other":
            break

    # Detect type: public vs internal
    event_label = "internal"

    # All webinars are public
    if event_type == "webinar":
        event_label = "public"
    else:
        # Check public keywords in topic
        for keyword in config.get("public_keywords", []):
            if keyword.lower() in topic_lower:
                event_label = "public"
                break

        # Participant threshold as safety net
        if event_label == "internal":
            min_p = config.get("public_min_participants", 15)
            if unique_participants >= min_p:
                event_label = "public"

    if str(event_id) in overrides:
        override = overrides[str(event_id)]
        program = override.get("program", program)
        event_label = override.get("type", event_label)

    return {"program": program, "type": event_label}


def deduplicate_participants(participants):
    """Deduplicate participants by email, keeping the longest session."""
    seen = {}
    for p in participants:
        email = (p.get("user_email") or p.get("email") or "").strip().lower()
        name = (p.get("name") or "").strip()
        key = email if email else name
        if not key:
            continue
        dur = p.get("duration", 0)
        if isinstance(dur, str):
            try:
                dur = int(dur)
            except (ValueError, TypeError):
                dur = 0
        if key not in seen or dur > seen[key].get("duration", 0):
            seen[key] = p
    return list(seen.values()), len(seen)


def build_upcoming_record(raw_meeting, registrants, config=None):
    """Build a lighter record for an upcoming/scheduled meeting (no attendance data yet)."""
    meeting_id = str(raw_meeting.get("id", ""))
    topic = raw_meeting.get("topic", "Untitled")
    start_time = raw_meeting.get("start_time", "")
    duration_min = raw_meeting.get("duration", 0)
    if isinstance(duration_min, str):
        try:
            duration_min = int(duration_min)
        except (ValueError, TypeError):
            duration_min = 0

    registrant_count = len(registrants) if registrants else 0
    labels = classify_event(topic, "meeting", 0, meeting_id, config or {})

    return {
        "meeting_id": meeting_id,
        "topic": topic,
        "program": labels["program"],
        "type": labels["type"],
        "start_time": start_time,
        "duration_min": duration_min,
        "registrants": registrant_count,
        "join_url": raw_meeting.get("join_url", ""),
        "registrants_detail": [
            {
                "name": ((r.get("first_name") or "").strip() + " " + (r.get("last_name") or "").strip()).strip(),
                "email": (r.get("email") or "").strip().lower(),
                "registered_at": r.get("create_time", ""),
            }
            for r in (registrants or [])
        ],
    }


def build_event_record(event_type, raw_event, participants, registrants=None, absentees=None, qa=None, config=None):
    """Build a normalized event record from meeting or webinar data."""
    event_id = str(raw_event.get("uuid") or raw_event.get("id", ""))
    topic = raw_event.get("topic", "Untitled")

    start_time = raw_event.get("start_time", "")
    end_time = raw_event.get("end_time", "")
    duration_min = raw_event.get("duration", 0)
    if isinstance(duration_min, str):
        try:
            duration_min = int(duration_min)
        except (ValueError, TypeError):
            duration_min = 0

    # For meetings from report endpoint, duration might be in minutes already
    # For webinars, scheduled duration is in minutes
    host_email = raw_event.get("host_email") or raw_event.get("email", "")

    deduped, unique_count = deduplicate_participants(participants)
    total_participants = raw_event.get("participants_count", len(participants))

    # Compute retention from participant data
    retention = compute_retention(participants, duration_min)

    # Registration data (webinars)
    registrant_count = len(registrants) if registrants else None
    absentee_count = len(absentees) if absentees else None
    attendance_rate = None
    if registrant_count and registrant_count > 0:
        attendance_rate = round(unique_count / registrant_count * 100, 1)

    # Q&A
    qa_count = len(qa) if qa else None

    labels = classify_event(topic, event_type, unique_count, event_id, config or {})

    # Participant summary (without full details to keep zoom_stats.json lean)
    participant_emails = []
    for p in deduped:
        email = (p.get("user_email") or p.get("email") or "").strip().lower()
        if email:
            participant_emails.append(email)

    return {
        "event_id": event_id,
        "meeting_id": str(raw_event.get("id", "")),
        "event_type": event_type,
        "program": labels["program"],
        "type": labels["type"],
        "topic": topic,
        "host_email": host_email,
        "start_time": start_time,
        "end_time": end_time,
        "duration_min": duration_min,
        "total_participants": total_participants,
        "unique_participants": unique_count,
        "registrants": registrant_count,
        "absentees": absentee_count,
        "attendance_rate": attendance_rate,
        "qa_count": qa_count,
        "participant_emails": participant_emails,
        "retention": retention,
        "participants_detail": [
            {
                "name": (p.get("name") or "").strip(),
                "email": (p.get("user_email") or p.get("email") or "").strip().lower(),
                "join_time": p.get("join_time", ""),
                "leave_time": p.get("leave_time", ""),
                "duration_sec": p.get("duration", 0),
            }
            for p in deduped
        ],
        "registrants_detail": [
            {
                "name": ((r.get("first_name") or "").strip() + " " + (r.get("last_name") or "").strip()).strip(),
                "email": (r.get("email") or "").strip().lower(),
                "registered_at": r.get("create_time", ""),
            }
            for r in (registrants or [])
        ],
    }


def track_repeat_attendees(events):
    """Build a participant index mapping emails to events attended."""
    email_to_events = defaultdict(list)

    for event in events:
        if event.get("type") != "public":
            continue
        for email in event.get("participant_emails", []):
            if email:
                email_to_events[email].append({
                    "event_id": event["event_id"],
                    "topic": event["topic"],
                    "date": event.get("start_time", "")[:10],
                })

    # Compute per-event repeat attendee rate
    for event in events:
        if event.get("type") != "public":
            event["repeat_attendee_pct"] = None
            continue
        emails = event.get("participant_emails", [])
        if not emails:
            event["repeat_attendee_pct"] = 0
            continue
        repeat_count = sum(1 for e in emails if e and len(email_to_events.get(e, [])) > 1)
        event["repeat_attendee_pct"] = round(repeat_count / len(emails) * 100, 1)

    # Overall stats
    total_unique = len(email_to_events)
    repeat_attendees = sum(1 for events_list in email_to_events.values() if len(events_list) > 1)
    avg_events_per_repeat = 0
    if repeat_attendees > 0:
        avg_events_per_repeat = round(
            sum(len(el) for el in email_to_events.values() if len(el) > 1) / repeat_attendees, 1
        )

    return {
        "total_unique_attendees": total_unique,
        "repeat_attendees": repeat_attendees,
        "repeat_rate_pct": round(repeat_attendees / total_unique * 100, 1) if total_unique > 0 else 0,
        "avg_events_per_repeat": avg_events_per_repeat,
        "participant_index": {
            email: [e["event_id"] for e in events_list]
            for email, events_list in email_to_events.items()
        },
    }


def build_attendee_summary(events):
    """Build per-attendee summary across ALL events (public + internal)."""
    attendees = {}  # email -> {name, total_duration_sec, events, last_event_date}

    for event in events:
        for p in event.get("participants_detail", []):
            email = (p.get("email") or "").strip().lower()
            name = (p.get("name") or "").strip()
            if not email and not name:
                continue
            key = email if email else name

            dur = p.get("duration_sec", 0)
            if isinstance(dur, str):
                try:
                    dur = int(dur)
                except (ValueError, TypeError):
                    dur = 0

            event_date = event.get("start_time", "")[:10]

            if key not in attendees:
                attendees[key] = {
                    "name": name,
                    "email": email,
                    "total_duration_min": 0,
                    "events_attended": 0,
                    "last_event_date": "",
                    "event_ids": [],
                }

            att = attendees[key]
            # Keep the most complete name
            if name and (not att["name"] or len(name) > len(att["name"])):
                att["name"] = name
            att["total_duration_min"] += round(dur / 60, 1)
            att["events_attended"] += 1
            att["event_ids"].append(event.get("event_id", ""))
            if event_date > att["last_event_date"]:
                att["last_event_date"] = event_date

    # Convert to sorted list (most events first)
    result = sorted(attendees.values(), key=lambda a: (-a["events_attended"], -a["total_duration_min"]))

    # Round total duration
    for a in result:
        a["total_duration_min"] = round(a["total_duration_min"], 1)
        del a["event_ids"]  # not needed in stats output

    return result


def build_monthly_trends(events):
    """Aggregate events by month for trend charts."""
    monthly = defaultdict(lambda: {
        "events": 0,
        "total_participants": 0,
        "total_registrants": 0,
        "attendance_rates": [],
        "retention_pcts": [],
    })

    for event in events:
        if event.get("type") != "public":
            continue
        month = event.get("start_time", "")[:7]  # "2025-11"
        if not month:
            continue
        m = monthly[month]
        m["events"] += 1
        m["total_participants"] += event.get("unique_participants", 0)
        if event.get("registrants"):
            m["total_registrants"] += event["registrants"]
        if event.get("attendance_rate") is not None:
            m["attendance_rates"].append(event["attendance_rate"])
        ret = event.get("retention", {}).get("avg_retention_pct", 0)
        if ret:
            m["retention_pcts"].append(ret)

    result = []
    for month in sorted(monthly.keys()):
        m = monthly[month]
        avg_att = round(sum(m["attendance_rates"]) / len(m["attendance_rates"]), 1) if m["attendance_rates"] else None
        avg_ret = round(sum(m["retention_pcts"]) / len(m["retention_pcts"]), 1) if m["retention_pcts"] else None
        result.append({
            "month": month,
            "events": m["events"],
            "total_participants": m["total_participants"],
            "avg_participants": round(m["total_participants"] / m["events"], 1) if m["events"] else 0,
            "avg_attendance_rate": avg_att,
            "avg_retention_pct": avg_ret,
        })

    return result


def build_stats(events, repeat_data, has_webinar_addon, pulled_at, attendee_summary=None):
    """Build the summary stats JSON."""
    external = [e for e in events if e.get("type") == "public"]

    total_participants = sum(e.get("unique_participants", 0) for e in external)
    avg_participants = round(total_participants / len(external), 1) if external else 0

    attendance_rates = [e["attendance_rate"] for e in external if e.get("attendance_rate") is not None]
    avg_attendance_rate = round(sum(attendance_rates) / len(attendance_rates), 1) if attendance_rates else None

    retention_pcts = [e["retention"]["avg_retention_pct"] for e in external if e.get("retention", {}).get("avg_retention_pct")]
    avg_retention = round(sum(retention_pcts) / len(retention_pcts), 1) if retention_pcts else None

    durations = [e["retention"]["avg_duration_min"] for e in external if e.get("retention", {}).get("avg_duration_min")]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else None

    total_qa = sum(e.get("qa_count", 0) or 0 for e in external)

    # Compute MoM for attendees
    monthly = build_monthly_trends(events)
    mom_pct = None
    if len(monthly) >= 2:
        current_month = monthly[-1]["total_participants"]
        prev_month = monthly[-2]["total_participants"]
        if prev_month > 0:
            mom_pct = round((current_month - prev_month) / prev_month * 100, 1)

    # All events (newest first) — dashboard filters by type client-side
    recent = sorted(events, key=lambda e: e.get("start_time", ""), reverse=True)
    recent_events = [
        {
            "event_id": e["event_id"],
            "topic": e["topic"],
            "event_type": e["event_type"],
            "program": e.get("program", "Other"),
            "type": e.get("type", "public"),
            "start_time": e["start_time"],
            "duration_min": e["duration_min"],
            "participants": e["unique_participants"],
            "registrants": e.get("registrants"),
            "attendance_rate": e.get("attendance_rate"),
            "avg_duration_min": e["retention"]["avg_duration_min"],
            "avg_retention_pct": e["retention"]["avg_retention_pct"],
            "retention_curve": e["retention"]["retention_curve"],
            "drop_off_label": e["retention"]["drop_off_label"],
            "peak_concurrent": e["retention"]["peak_concurrent"],
            "qa_count": e.get("qa_count"),
            "repeat_attendee_pct": e.get("repeat_attendee_pct"),
            "participants_detail": e.get("participants_detail", []),
            "registrants_detail": e.get("registrants_detail", []),
        }
        for e in recent
    ]

    return {
        "has_webinar_addon": has_webinar_addon,
        "total_events": len(external),
        "total_meetings": sum(1 for e in external if e["event_type"] == "meeting"),
        "total_webinars": sum(1 for e in external if e["event_type"] == "webinar"),
        "total_participants_all_time": total_participants,
        "avg_participants_per_event": avg_participants,
        "avg_attendance_rate": avg_attendance_rate,
        "avg_retention_pct": avg_retention,
        "avg_duration_min": avg_duration,
        "total_qa_questions": total_qa,
        "mom_pct": mom_pct,
        "repeat_attendee_stats": {
            "total_unique_attendees": repeat_data["total_unique_attendees"],
            "repeat_attendees": repeat_data["repeat_attendees"],
            "repeat_rate_pct": repeat_data["repeat_rate_pct"],
            "avg_events_per_repeat": repeat_data["avg_events_per_repeat"],
        },
        "events_by_month": monthly,
        "recent_events": recent_events,
        "attendee_summary": attendee_summary or [],
        "pulled_at": pulled_at,
    }


def main():
    print("=" * 60)
    print("IPN Analytics Dashboard — Zoom Data Pull")
    print("=" * 60)

    env_loaded_from = load_env()
    if env_loaded_from:
        print(f"Loaded env vars from: {env_loaded_from}")

    # Verify credentials
    account_id = os.environ.get("ZOOM_ACCOUNT_ID", "").strip()
    if not account_id:
        print("ERROR: ZOOM_ACCOUNT_ID not found in .env")
        print("Add: ZOOM_ACCOUNT_ID=your_account_id")
        sys.exit(1)

    config = load_config()
    print(f"Loaded classification config: {len(config.get('programs', {}))} programs, "
          f"{len(config.get('public_keywords', []))} public keywords, "
          f"min {config.get('public_min_participants', 15)} participants, "
          f"{len(config.get('overrides', {}))} overrides")

    try:
        # Authenticate
        print("\nAuthenticating with Zoom...")
        get_access_token()
        print("  Authentication successful")

        # Discover users
        print("\nDiscovering users...")
        users = discover_users()

        # Check for webinar addon using first user
        primary_user_id = users[0]["id"] if users else "me"
        has_webinar_addon = detect_webinar_addon(primary_user_id)
        print(f"  Webinar add-on: {'detected' if has_webinar_addon else 'not detected (meetings only)'}")

        # Pull events for each user
        all_events = []
        pull_errors = []
        upcoming_events = []
        for user in users:
            user_id = user["id"]
            user_email = user.get("email", user_id)
            print(f"\nPulling events for {user_email}...")

            # Pull meetings
            meetings = pull_past_meetings(user_id)

            # Pull webinars
            webinars = []
            if has_webinar_addon:
                webinars = pull_past_webinars(user_id)

            # Pull upcoming/scheduled meetings.
            # Note: Zoom returns the *series* start_time for recurring meetings, which is often in
            # the past. For recurring meetings with fixed times (type=8), use the `occurrences`
            # array on the full meeting record to find the next future instance.
            scheduled = pull_scheduled_meetings(user_id)
            now_utc = datetime.now(timezone.utc)
            far_future = now_utc + timedelta(days=730)  # 2 years cap
            for sm in scheduled:
                meeting_id = sm.get("id")
                if not meeting_id:
                    continue
                start_time = sm.get("start_time", "")
                next_start = parse_zoom_datetime(start_time)

                # For recurring meetings with fixed times, fetch occurrences and pick the next future one
                if sm.get("type") == 8:
                    detail = api_get(f"/meetings/{meeting_id}", {"show_previous_occurrences": "false"})
                    if detail:
                        future_occs = []
                        for occ in detail.get("occurrences", []):
                            if occ.get("status") == "deleted":
                                continue
                            occ_dt = parse_zoom_datetime(occ.get("start_time", ""))
                            if occ_dt and occ_dt > now_utc:
                                future_occs.append((occ_dt, occ))
                        if future_occs:
                            future_occs.sort(key=lambda x: x[0])
                            next_dt, next_occ = future_occs[0]
                            next_start = next_dt
                            start_time = next_occ.get("start_time", start_time)

                # Skip meetings whose next start is in the past or absurdly far in the future
                if not next_start or next_start <= now_utc or next_start > far_future:
                    continue

                # Inject the resolved start_time back into the raw meeting before building record
                sm_resolved = dict(sm)
                sm_resolved["start_time"] = start_time

                print(f"    Processing upcoming: {sm.get('topic', 'Untitled')[:50]}...")
                regs = pull_meeting_registrants(meeting_id)
                upcoming_events.append(build_upcoming_record(sm_resolved, regs, config=config))

            # Process meetings
            for meeting in meetings:
                meeting_id = meeting.get("uuid") or meeting.get("id")
                if not meeting_id:
                    continue

                total_p = meeting.get("participants_count", 0)
                if total_p < 3:
                    continue  # Skip small meetings (likely 1-on-1s)

                topic = meeting.get("topic", "Untitled")
                print(f"    Processing meeting: {topic[:50]}...")
                try:
                    participants = pull_participants("meeting", meeting_id)
                except RuntimeError as exc:
                    pull_errors.append({
                        "event_type": "meeting",
                        "event_id": meeting_id,
                        "topic": topic,
                        "error": str(exc),
                    })
                    print(f"      WARNING: skipping meeting participant report: {exc}")
                    continue

                try:
                    registrants = pull_meeting_registrants(meeting.get("id", meeting_id))
                except RuntimeError as exc:
                    pull_errors.append({
                        "event_type": "meeting_registrants",
                        "event_id": meeting.get("id", meeting_id),
                        "topic": topic,
                        "error": str(exc),
                    })
                    print(f"      WARNING: continuing without meeting registrants: {exc}")
                    registrants = []

                record = build_event_record(
                    "meeting", meeting, participants,
                    registrants=registrants, config=config,
                )
                all_events.append(record)

            # Process webinars
            for webinar in webinars:
                webinar_id = webinar.get("uuid") or webinar.get("id")
                if not webinar_id:
                    continue

                topic = webinar.get("topic", "Untitled")
                print(f"    Processing webinar: {topic[:50]}...")
                try:
                    participants = pull_participants("webinar", webinar_id)
                except RuntimeError as exc:
                    pull_errors.append({
                        "event_type": "webinar",
                        "event_id": webinar_id,
                        "topic": topic,
                        "error": str(exc),
                    })
                    print(f"      WARNING: skipping webinar participant report: {exc}")
                    continue

                try:
                    registrants = pull_webinar_registrants(webinar.get("id", webinar_id))
                except RuntimeError as exc:
                    pull_errors.append({
                        "event_type": "webinar_registrants",
                        "event_id": webinar.get("id", webinar_id),
                        "topic": topic,
                        "error": str(exc),
                    })
                    print(f"      WARNING: continuing without webinar registrants: {exc}")
                    registrants = []

                try:
                    absentees = pull_webinar_absentees(webinar_id)
                except RuntimeError as exc:
                    pull_errors.append({
                        "event_type": "webinar_absentees",
                        "event_id": webinar_id,
                        "topic": topic,
                        "error": str(exc),
                    })
                    print(f"      WARNING: continuing without webinar absentees: {exc}")
                    absentees = []

                # Q&A (nice-to-have, don't fail on error)
                qa = []
                try:
                    qa = pull_webinar_qa(webinar_id)
                except Exception:
                    pass

                record = build_event_record(
                    "webinar", webinar, participants,
                    registrants=registrants, absentees=absentees, qa=qa,
                    config=config,
                )
                all_events.append(record)

        # Merge with previously saved events to preserve historical data
        existing_path = DATA_DIR / "zoom_events.json"
        if existing_path.exists():
            with open(existing_path) as f:
                existing_data = json.load(f)
            existing_events = existing_data.get("events", [])
            # Index new events by event_id for fast lookup
            new_ids = {e["event_id"] for e in all_events}
            # Keep old events that aren't in the new pull (aged out of API window)
            preserved = [e for e in existing_events if e["event_id"] not in new_ids]
            if preserved:
                print(f"  Preserving {len(preserved)} historical event(s) beyond API window")
            all_events = preserved + all_events

        # Sort by start time
        all_events.sort(key=lambda e: e.get("start_time", ""))

        # Track repeat attendees
        print("\nTracking repeat attendees...")
        repeat_data = track_repeat_attendees(all_events)
        print(f"  {repeat_data['total_unique_attendees']} unique attendees, "
              f"{repeat_data['repeat_attendees']} repeat ({repeat_data['repeat_rate_pct']}%)")

        # Build attendee summary across ALL events
        print("\nBuilding attendee summary...")
        attendee_summary = build_attendee_summary(all_events)
        print(f"  {len(attendee_summary)} unique attendees across all events")

        pulled_at = datetime.now(timezone.utc).isoformat()

        # Sort upcoming events soonest-first
        upcoming_events.sort(key=lambda e: e.get("start_time", ""))

        # Build stats summary
        stats = build_stats(all_events, repeat_data, has_webinar_addon, pulled_at, attendee_summary)
        stats["upcoming_events"] = upcoming_events

        # Save output files
        print("\nSaving data...")
        save_json("zoom_stats.json", stats)
        save_json("zoom_events.json", {
            "events": all_events,
            "participant_index": repeat_data["participant_index"],
            "pulled_at": pulled_at,
            "pull_errors": pull_errors,
        })
        save_json("zoom_last_pull.json", {
            "last_pull": pulled_at,
            "status": "success_with_warnings" if pull_errors else "success",
            "events_pulled": len(all_events),
            "public_events": stats["total_events"],
            "has_webinar_addon": has_webinar_addon,
            "warnings": pull_errors,
        })

        # Print summary
        public_count = stats["total_events"]
        internal_count = len(all_events) - public_count
        print(f"\nSummary")
        print(f"  Total events pulled: {len(all_events)}")
        print(f"  Public events: {public_count}")
        print(f"  Internal meetings (excluded from dashboard): {internal_count}")
        print(f"  Total participants (external): {stats['total_participants_all_time']}")
        print(f"  Avg participants/event: {stats['avg_participants_per_event']}")
        if stats['avg_attendance_rate'] is not None:
            print(f"  Avg attendance rate: {stats['avg_attendance_rate']}%")
        if stats['avg_retention_pct'] is not None:
            print(f"  Avg retention: {stats['avg_retention_pct']}%")
        if stats['avg_duration_min'] is not None:
            print(f"  Avg attendance duration: {stats['avg_duration_min']} min")
        print(f"  Repeat attendee rate: {repeat_data['repeat_rate_pct']}%")
        if pull_errors:
            print(f"  Warnings: {len(pull_errors)} event report issue(s); see zoom_last_pull.json")
        print(f"  Upcoming events: {len(upcoming_events)}"
              + (f" ({sum(e['registrants'] for e in upcoming_events)} total registrations so far)" if upcoming_events else ""))
        print(f"  Pulled at: {pulled_at}")

    except Exception as exc:
        pulled_at = datetime.now(timezone.utc).isoformat()
        save_json(
            "zoom_last_pull.json",
            {"last_pull": pulled_at, "status": "error", "error": str(exc)},
        )
        print(f"\nERROR: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
