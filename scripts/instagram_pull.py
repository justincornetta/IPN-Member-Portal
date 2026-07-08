#!/usr/bin/env python3
"""
IPN Analytics Dashboard — Instagram + Facebook Data Pull
Pulls Instagram Business profile/media metrics and Facebook Page metrics from Meta Graph API.

Usage:
    python3 scripts/instagram_pull.py

Requires (in .env):
    - INSTAGRAM_ACCESS_TOKEN (required)
    - INSTAGRAM_BUSINESS_ACCOUNT_ID (recommended)
    - FACEBOOK_PAGE_ID (recommended for FB metrics; optional if auto-discovery works)
    - INSTAGRAM_USERNAME (optional, helps auto-select if multiple IG accounts found)

Output files (in ../data/):
    - instagram_stats.json
    - instagram_media.json
    - instagram_last_pull.json
    - facebook_stats.json
    - facebook_last_pull.json
    - social_stats.json (instagram/facebook sections are updated)
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library not found. Install with: pip3 install requests")
    sys.exit(1)


import re


def _parse_iso(ts: str) -> datetime:
    """Parse ISO timestamps, handling +0000 (no colon) and Z variants."""
    ts = ts.replace("Z", "+00:00")
    ts = re.sub(r'([+-]\d{2})(\d{2})$', r'\1:\2', ts)
    return datetime.fromisoformat(ts)


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
ENV_PATHS = [
    PROJECT_DIR / ".env",
    PROJECT_DIR / ".env.local",
    PROJECT_DIR.parent / "workspace" / ".env",
    Path.home() / ".openclaw" / "workspace" / ".env",
]

GRAPH_BASE_URL = "https://graph.facebook.com/v20.0"
LOOKBACK_DAYS = 30
MAX_MEDIA = 100
MAX_FB_POSTS = 100


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


def api_get(path, token, params=None):
    """GET request to Meta Graph API."""
    request_params = {"access_token": token}
    if params:
        request_params.update(params)

    response = requests.get(f"{GRAPH_BASE_URL}{path}", params=request_params, timeout=30)
    if response.status_code == 200:
        return response.json()

    detail = response.text[:400]
    raise RuntimeError(f"Meta API error {response.status_code} for {path}: {detail}")


def save_json(filename, data):
    DATA_DIR.mkdir(exist_ok=True)
    out_path = DATA_DIR / filename
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Saved: {out_path}")


def discover_linked_accounts(token):
    """Return linked FB pages and IG business accounts visible to this token."""
    accounts = api_get(
        "/me/accounts",
        token,
        params={"fields": "id,name,access_token,instagram_business_account{id,username}", "limit": 50},
    )

    linked = []
    for page in accounts.get("data", []):
        ig = page.get("instagram_business_account") or {}
        if ig.get("id"):
            linked.append(
                {
                    "page_id": page.get("id"),
                    "page_name": page.get("name"),
                    "page_token": page.get("access_token"),
                    "ig_id": ig.get("id"),
                    "ig_username": ig.get("username"),
                }
            )
    return linked


def resolve_meta_ids(token):
    """
    Resolve IG account + FB page IDs.

    Priority:
    1) INSTAGRAM_BUSINESS_ACCOUNT_ID / FACEBOOK_PAGE_ID
    2) FACEBOOK_PAGE_ID -> linked IG account
    3) /me/accounts auto-discovery, optionally filtered by INSTAGRAM_USERNAME
    """
    explicit_ig_id = os.environ.get("INSTAGRAM_BUSINESS_ACCOUNT_ID", "").strip()
    explicit_page_id = os.environ.get("FACEBOOK_PAGE_ID", "").strip()

    if explicit_ig_id and explicit_page_id:
        page = api_get(
            f"/{explicit_page_id}",
            token,
            params={"fields": "id,name,instagram_business_account{id,username}"},
        )
        page_ig = (page.get("instagram_business_account") or {}).get("id")
        if page_ig and page_ig != explicit_ig_id:
            raise RuntimeError(
                "INSTAGRAM_BUSINESS_ACCOUNT_ID does not match the Instagram account linked to FACEBOOK_PAGE_ID."
            )
        return {
            "ig_id": explicit_ig_id,
            "ig_source": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
            "page_id": explicit_page_id,
            "page_name": page.get("name"),
            "page_source": "FACEBOOK_PAGE_ID",
        }

    if explicit_page_id:
        page = api_get(
            f"/{explicit_page_id}",
            token,
            params={"fields": "id,name,instagram_business_account{id,username}"},
        )
        ig = page.get("instagram_business_account") or {}
        if not ig.get("id") and not explicit_ig_id:
            raise RuntimeError(
                "FACEBOOK_PAGE_ID provided but no instagram_business_account is linked. "
                "Set INSTAGRAM_BUSINESS_ACCOUNT_ID directly."
            )
        return {
            "ig_id": explicit_ig_id or ig.get("id"),
            "ig_source": "INSTAGRAM_BUSINESS_ACCOUNT_ID" if explicit_ig_id else f"FACEBOOK_PAGE_ID ({page.get('name', explicit_page_id)})",
            "page_id": explicit_page_id,
            "page_name": page.get("name"),
            "page_source": "FACEBOOK_PAGE_ID",
        }

    linked = discover_linked_accounts(token)
    if not linked:
        if explicit_ig_id:
            return {
                "ig_id": explicit_ig_id,
                "ig_source": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
                "page_id": None,
                "page_name": None,
                "page_source": None,
            }
        raise RuntimeError(
            "Could not find any linked Instagram account via /me/accounts. "
            "Set INSTAGRAM_BUSINESS_ACCOUNT_ID directly."
        )

    username_hint = os.environ.get("INSTAGRAM_USERNAME", "").strip().lower()
    selected = None

    if explicit_ig_id:
        for candidate in linked:
            if candidate.get("ig_id") == explicit_ig_id:
                selected = candidate
                break
        if selected:
            return {
                "ig_id": explicit_ig_id,
                "ig_source": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
                "page_id": selected.get("page_id"),
                "page_name": selected.get("page_name"),
                "page_source": "auto-discovery via IG match",
            }
        return {
            "ig_id": explicit_ig_id,
            "ig_source": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
            "page_id": None,
            "page_name": None,
            "page_source": None,
        }

    if len(linked) == 1:
        selected = linked[0]
    elif username_hint:
        for candidate in linked:
            if (candidate.get("ig_username") or "").strip().lower() == username_hint:
                selected = candidate
                break

    if not selected:
        lines = [
            "Multiple linked Instagram accounts found. Set INSTAGRAM_BUSINESS_ACCOUNT_ID or INSTAGRAM_USERNAME.",
            "Candidates:",
        ]
        for candidate in linked:
            lines.append(
                f"  - @{candidate.get('ig_username')} (IG ID: {candidate.get('ig_id')}, Page: {candidate.get('page_name')})"
            )
        raise RuntimeError("\n".join(lines))

    return {
        "ig_id": selected.get("ig_id"),
        "ig_source": f"auto-discovery (@{selected.get('ig_username')} via page {selected.get('page_name')})",
        "page_id": selected.get("page_id"),
        "page_name": selected.get("page_name"),
        "page_source": "auto-discovery",
    }


def pull_instagram_profile(token, ig_account_id):
    """Pull top-level Instagram profile stats."""
    return api_get(
        f"/{ig_account_id}",
        token,
        params={"fields": "id,username,name,followers_count,follows_count,media_count,biography,website"},
    )


def pull_recent_instagram_media(token, ig_account_id, lookback_days=LOOKBACK_DAYS, max_media=MAX_MEDIA):
    """Pull recent Instagram media and compute engagement."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    endpoint = f"/{ig_account_id}/media"
    params = {
        "fields": "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count",
        "limit": 50,
    }

    media = []
    next_url = None
    while len(media) < max_media:
        if next_url:
            response = requests.get(next_url, timeout=30)
            if response.status_code != 200:
                break
            data = response.json()
        else:
            data = api_get(endpoint, token, params=params)

        batch = data.get("data", [])
        if not batch:
            break

        stop_paging = False
        for item in batch:
            ts = item.get("timestamp")
            if not ts:
                continue
            dt = _parse_iso(ts)
            if dt < cutoff:
                stop_paging = True
                break
            media.append(
                {
                    "id": item.get("id"),
                    "timestamp": ts,
                    "media_type": item.get("media_type"),
                    "media_product_type": item.get("media_product_type"),
                    "permalink": item.get("permalink"),
                    "like_count": item.get("like_count", 0) or 0,
                    "comments_count": item.get("comments_count", 0) or 0,
                    "caption": (item.get("caption") or "")[:280],
                }
            )
            if len(media) >= max_media:
                break

        if stop_paging or len(media) >= max_media:
            break

        next_url = (data.get("paging") or {}).get("next")
        if not next_url:
            break

    return media


def pull_facebook_page_profile(token, page_id):
    """Pull Facebook Page profile and headline stats."""
    return api_get(
        f"/{page_id}",
        token,
        params={"fields": "id,name,fan_count,followers_count,link"},
    )


def pull_recent_facebook_posts(token, page_id, lookback_days=LOOKBACK_DAYS, max_posts=MAX_FB_POSTS):
    """Pull recent Facebook posts with lightweight engagement fields."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    endpoint = f"/{page_id}/posts"

    # Try engagement fields first; fall back to basic fields if
    # pages_read_engagement isn't available (e.g. app in Development mode).
    FIELDS_FULL = "id,message,created_time,permalink_url,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares"
    FIELDS_BASIC = "id,message,created_time,permalink_url"

    use_basic = False
    params = {"fields": FIELDS_FULL, "limit": 25}

    posts = []
    next_url = None
    while len(posts) < max_posts:
        if next_url:
            response = requests.get(next_url, timeout=30)
            if response.status_code != 200:
                break
            data = response.json()
        else:
            try:
                data = api_get(endpoint, token, params=params)
            except RuntimeError:
                if not use_basic:
                    print("  Note: engagement fields unavailable (pages_read_engagement may need App Review). Using basic fields.")
                    use_basic = True
                    params["fields"] = FIELDS_BASIC
                    data = api_get(endpoint, token, params=params)
                else:
                    raise

        batch = data.get("data", [])
        if not batch:
            break

        stop_paging = False
        for item in batch:
            ts = item.get("created_time")
            if not ts:
                continue
            dt = _parse_iso(ts)
            if dt < cutoff:
                stop_paging = True
                break

            reactions = ((item.get("reactions") or {}).get("summary") or {}).get("total_count", 0) or 0
            comments = ((item.get("comments") or {}).get("summary") or {}).get("total_count", 0) or 0
            shares = (item.get("shares") or {}).get("count", 0) or 0

            posts.append(
                {
                    "id": item.get("id"),
                    "created_time": ts,
                    "permalink_url": item.get("permalink_url"),
                    "message": (item.get("message") or "")[:280],
                    "reactions_count": reactions,
                    "comments_count": comments,
                    "shares_count": shares,
                }
            )
            if len(posts) >= max_posts:
                break

        if stop_paging or len(posts) >= max_posts:
            break

        next_url = (data.get("paging") or {}).get("next")
        if not next_url:
            break

    return posts


def average_engagement_rate(posts, audience_size, likes_key="like_count", comments_key="comments_count", shares_key=None):
    """Average per-post engagement rate = interactions / audience * 100."""
    if not posts or not audience_size:
        return 0.0

    rates = []
    for post in posts:
        interactions = (post.get(likes_key, 0) or 0) + (post.get(comments_key, 0) or 0)
        if shares_key:
            interactions += post.get(shares_key, 0) or 0
        rates.append((interactions / audience_size) * 100)
    return round(sum(rates) / len(rates), 2)


def count_posts_this_month(posts, timestamp_key):
    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    return sum(1 for post in posts if (post.get(timestamp_key) or "").startswith(month_prefix))


def build_empty_social_stats():
    return {
        "_instructions": "Update this file weekly with social media stats from each platform's native analytics.",
        "instagram": {},
        "facebook": {},
        "linkedin": {},
        "x_twitter": {},
        "youtube": {},
        "history": [],
    }


def update_social_stats(ig_profile, ig_media, fb_profile, fb_posts, pulled_at):
    """Patch instagram/facebook sections in social_stats.json while preserving other platforms."""
    social_path = DATA_DIR / "social_stats.json"
    if social_path.exists():
        with open(social_path) as f:
            social = json.load(f)
    else:
        social = build_empty_social_stats()

    if "facebook" not in social:
        social["facebook"] = {}

    ig_followers = ig_profile.get("followers_count")
    ig_engagement = average_engagement_rate(ig_media, ig_followers)
    ig_month_posts = count_posts_this_month(ig_media, "timestamp")

    social["instagram"] = {
        "account_id": ig_profile.get("id"),
        "username": ig_profile.get("username"),
        "followers": ig_followers,
        "avg_engagement_rate": ig_engagement,
        "posts_this_month": ig_month_posts,
        "recent_posts_30d": len(ig_media),
        "updated_at": pulled_at,
    }

    history = social.get("history")
    if not isinstance(history, list):
        history = []

    history.append(
        {
            "month": datetime.now(timezone.utc).strftime("%Y-%m"),
            "channel": "instagram",
            "followers": ig_followers,
            "avg_engagement_rate": ig_engagement,
            "posts_this_month": ig_month_posts,
            "updated_at": pulled_at,
        }
    )

    if fb_profile:
        fb_followers = fb_profile.get("followers_count") or fb_profile.get("fan_count")
        fb_engagement = average_engagement_rate(
            fb_posts,
            fb_followers,
            likes_key="reactions_count",
            comments_key="comments_count",
            shares_key="shares_count",
        )
        fb_month_posts = count_posts_this_month(fb_posts, "created_time")

        social["facebook"] = {
            "page_id": fb_profile.get("id"),
            "page_name": fb_profile.get("name"),
            "followers": fb_profile.get("followers_count"),
            "fans": fb_profile.get("fan_count"),
            "avg_engagement_rate": fb_engagement,
            "posts_this_month": fb_month_posts,
            "recent_posts_30d": len(fb_posts),
            "updated_at": pulled_at,
        }

        history.append(
            {
                "month": datetime.now(timezone.utc).strftime("%Y-%m"),
                "channel": "facebook",
                "followers": fb_followers,
                "avg_engagement_rate": fb_engagement,
                "posts_this_month": fb_month_posts,
                "updated_at": pulled_at,
            }
        )

    social["history"] = history[-72:]
    save_json("social_stats.json", social)


def main():
    print("=" * 60)
    print("IPN Analytics Dashboard — Instagram + Facebook Data Pull")
    print("=" * 60)

    env_loaded_from = load_env()
    if env_loaded_from:
        print(f"Loaded env vars from: {env_loaded_from}")

    token = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
    if not token:
        print("ERROR: INSTAGRAM_ACCESS_TOKEN not found in .env")
        print("Add: INSTAGRAM_ACCESS_TOKEN=your_long_lived_token")
        sys.exit(1)

    try:
        resolved = resolve_meta_ids(token)
        ig_account_id = resolved.get("ig_id")
        page_id = resolved.get("page_id")

        print(f"Using IG account ID: {ig_account_id} ({resolved.get('ig_source')})")
        if page_id:
            print(f"Using FB page ID: {page_id} ({resolved.get('page_source')})")
        else:
            print("Facebook page ID not resolved. Facebook metrics will be skipped.")

        ig_profile = pull_instagram_profile(token, ig_account_id)
        ig_media = pull_recent_instagram_media(token, ig_account_id)
        pulled_at = datetime.now(timezone.utc).isoformat()

        ig_avg_engagement = average_engagement_rate(ig_media, ig_profile.get("followers_count"))

        instagram_stats = {
            "account_id": ig_profile.get("id"),
            "username": ig_profile.get("username"),
            "name": ig_profile.get("name"),
            "followers_count": ig_profile.get("followers_count"),
            "follows_count": ig_profile.get("follows_count"),
            "media_count": ig_profile.get("media_count"),
            "avg_engagement_rate_30d": ig_avg_engagement,
            "recent_posts_30d": len(ig_media),
            "pulled_at": pulled_at,
        }

        instagram_media = {
            "account_id": ig_profile.get("id"),
            "username": ig_profile.get("username"),
            "lookback_days": LOOKBACK_DAYS,
            "posts": ig_media,
            "pulled_at": pulled_at,
        }

        save_json("instagram_stats.json", instagram_stats)
        save_json("instagram_media.json", instagram_media)
        save_json(
            "instagram_last_pull.json",
            {
                "last_pull": pulled_at,
                "status": "success",
                "account_id": ig_profile.get("id"),
                "username": ig_profile.get("username"),
                "posts_30d": len(ig_media),
            },
        )

        fb_profile = None
        fb_posts = []
        facebook_status = {"status": "skipped", "reason": "facebook_page_id_not_resolved"}

        if page_id:
            # Use a Page Access Token for Facebook endpoints (required for
            # reactions/comments/shares summaries). Fall back to user token.
            page_token = token
            try:
                accounts = api_get(
                    "/me/accounts",
                    token,
                    params={"fields": "id,access_token", "limit": 50},
                )
                for acct in accounts.get("data", []):
                    if acct.get("id") == page_id:
                        page_token = acct.get("access_token", token)
                        break
            except Exception:
                pass  # fall back to user token

            fb_profile = pull_facebook_page_profile(page_token, page_id)
            fb_posts = pull_recent_facebook_posts(page_token, page_id)
            fb_followers = fb_profile.get("followers_count") or fb_profile.get("fan_count")
            fb_avg_engagement = average_engagement_rate(
                fb_posts,
                fb_followers,
                likes_key="reactions_count",
                comments_key="comments_count",
                shares_key="shares_count",
            )

            facebook_stats = {
                "page_id": fb_profile.get("id"),
                "page_name": fb_profile.get("name"),
                "fan_count": fb_profile.get("fan_count"),
                "followers_count": fb_profile.get("followers_count"),
                "avg_engagement_rate_30d": fb_avg_engagement,
                "recent_posts_30d": len(fb_posts),
                "posts": fb_posts,
                "pulled_at": pulled_at,
            }
            save_json("facebook_stats.json", facebook_stats)

            facebook_status = {
                "status": "success",
                "page_id": fb_profile.get("id"),
                "page_name": fb_profile.get("name"),
                "posts_30d": len(fb_posts),
            }

        save_json(
            "facebook_last_pull.json",
            {
                "last_pull": pulled_at,
                **facebook_status,
            },
        )

        update_social_stats(ig_profile, ig_media, fb_profile, fb_posts, pulled_at)

        print("\nSummary")
        print(f"  Instagram account: @{ig_profile.get('username')} ({ig_profile.get('name')})")
        print(f"  Instagram followers: {ig_profile.get('followers_count')}")
        print(f"  Instagram recent posts (30d): {len(ig_media)}")
        print(f"  Instagram avg engagement rate (30d): {ig_avg_engagement}%")

        if fb_profile:
            print(f"  Facebook page: {fb_profile.get('name')} (ID: {fb_profile.get('id')})")
            print(f"  Facebook followers: {fb_profile.get('followers_count') or fb_profile.get('fan_count')}")
            print(f"  Facebook recent posts (30d): {len(fb_posts)}")
        else:
            print("  Facebook metrics: skipped (set FACEBOOK_PAGE_ID or ensure account auto-discovery)")

        print(f"  Pulled at: {pulled_at}")

    except Exception as exc:
        pulled_at = datetime.now(timezone.utc).isoformat()
        save_json(
            "instagram_last_pull.json",
            {"last_pull": pulled_at, "status": "error", "error": str(exc)},
        )
        save_json(
            "facebook_last_pull.json",
            {"last_pull": pulled_at, "status": "error", "error": str(exc)},
        )
        print(f"\nERROR: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
