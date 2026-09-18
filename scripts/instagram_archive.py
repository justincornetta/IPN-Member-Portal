"""Small, ID-keyed Instagram archive; no media binaries or API credentials stored."""
from datetime import datetime, timedelta, timezone
import re


FIELDS = "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count"


def parse_timestamp(value):
    value = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", value.replace("Z", "+00:00"))
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise RuntimeError("Instagram timestamp lacks a timezone; archive preserved.")
    return parsed


def merge_posts(existing, incoming, observed_at=None):
    by_id = {str(row["id"]): dict(row) for row in existing if row.get("id")}
    for row in incoming:
        if not row.get("id") or not row.get("timestamp"):
            raise RuntimeError("Instagram returned a post without its ID or timestamp; archive preserved.")
        parse_timestamp(row["timestamp"])
        by_id[str(row["id"])] = {
            "id": str(row["id"]), "timestamp": row["timestamp"],
            "media_type": row.get("media_type"), "media_product_type": row.get("media_product_type"),
            "permalink": row.get("permalink") or "", "caption": (row.get("caption") or "")[:280],
            "like_count": row.get("like_count") or 0, "comments_count": row.get("comments_count") or 0,
            "last_observed_at": observed_at,
        }
    return sorted(by_id.values(), key=lambda row: parse_timestamp(row["timestamp"]), reverse=True)


def recent_posts(posts, now, days=30):
    cutoff = now - timedelta(days=days)
    return [row for row in posts if cutoff <= parse_timestamp(row["timestamp"]) <= now]


def fetch_pages(fetch, account_id, max_pages=100, after=None, cutoff=None, checkpoint=None):
    """Follow cursor pagination, never persist token-bearing paging URLs.

    Recent discovery retains the existing reverse-chronological feed boundary.
    Full backfill does not use this assumption or stop at an old timestamp.
    """
    posts, seen = [], set()
    for _ in range(max_pages):
        params = {"fields": FIELDS, "limit": 50}
        if after:
            params["after"] = after
        payload = fetch(f"/{account_id}/media", params)
        if not isinstance(payload.get("data"), list) or payload.get("error"):
            raise RuntimeError("Invalid Instagram page; previous archive preserved.")
        batch = merge_posts([], payload["data"])
        posts.extend(batch)
        paging = payload.get("paging") or {}
        next_after = (paging.get("cursors") or {}).get("after") if paging.get("next") else None
        if paging.get("next") and not next_after:
            raise RuntimeError("Instagram pagination cursor missing; previous archive preserved.")
        complete = not paging.get("next")
        if not complete and (next_after in seen or next_after == after):
            raise RuntimeError("Instagram repeated a pagination cursor; previous archive preserved.")
        if checkpoint:
            checkpoint(batch, next_after, complete)
        if complete:
            return merge_posts([], posts), True
        if cutoff and batch and all(parse_timestamp(row["timestamp"]) < cutoff for row in batch):
            return merge_posts([], posts), False
        seen.add(next_after)
        after = next_after
    if cutoff:
        raise RuntimeError("Instagram recent refresh page budget exhausted; previous archive preserved.")
    return merge_posts([], posts), False
