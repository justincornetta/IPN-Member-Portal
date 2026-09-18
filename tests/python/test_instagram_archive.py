import sys
import unittest
import importlib.util
import types
import json
import tempfile
from unittest.mock import patch
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from instagram_archive import fetch_pages, merge_posts, recent_posts, parse_timestamp


def post(identifier, date="2020-01-01T12:00:00Z", likes=1):
    return {"id": str(identifier), "timestamp": date, "like_count": likes}


class ArchiveTests(unittest.TestCase):
    def test_meta_offset_and_timezone_required(self):
        self.assertEqual(parse_timestamp("2026-09-02T18:55:05+0000"), parse_timestamp("2026-09-02T18:55:05Z"))
        with self.assertRaisesRegex(RuntimeError, "timezone"):
            parse_timestamp("2026-09-02T18:55:05")

    def test_backfill_passes_100_posts_and_resume_cursor(self):
        calls, checkpoints = [], []
        def fetch(path, params):
            calls.append(params.get("after"))
            offset = int(params.get("after", "0"))
            return {"data": [post(i) for i in range(offset, offset + 50)], "paging":
                    {"next": "token-bearing-url-never-followed", "cursors": {"after": str(offset + 50)}} if offset < 100 else {}}
        rows, complete = fetch_pages(fetch, "account", max_pages=3, checkpoint=lambda batch, after, done: checkpoints.append((len(batch), after, done)))
        self.assertEqual(len(rows), 150)
        self.assertTrue(complete)
        self.assertEqual(calls, [None, "50", "100"])
        rows, complete = fetch_pages(fetch, "account", max_pages=1, after="50")
        self.assertFalse(complete)
        self.assertEqual(len(rows), 50)
        self.assertEqual(checkpoints[-1], (50, None, True))

    def test_failures_never_return_partial_success(self):
        def fetch(path, params):
            if params.get("after"):
                raise RuntimeError("API failure")
            return {"data": [post(1)], "paging": {"next": "url", "cursors": {"after": "next"}}}
        with self.assertRaisesRegex(RuntimeError, "API failure"):
            fetch_pages(fetch, "account")
        with self.assertRaisesRegex(RuntimeError, "cursor missing"):
            fetch_pages(lambda path, params: {"data": [], "paging": {"next": "url"}}, "account")
        with self.assertRaisesRegex(RuntimeError, "repeated"):
            fetch_pages(lambda path, params: {"data": [post(1)], "paging": {"next": "url", "cursors": {"after": "same"}}}, "account")

    def test_metrics_use_only_recent_published_posts(self):
        now = datetime(2026, 9, 18, 12, tzinfo=timezone.utc)
        archive = merge_posts([post("old")], [post("recent", "2026-09-01T12:00:00Z"), post("future", "2027-01-01T12:00:00Z"), post("old", likes=8)], "2026-09-18")
        self.assertEqual(len(archive), 3)
        self.assertEqual(archive[-1]["like_count"], 8)
        self.assertEqual([row["id"] for row in recent_posts(archive, now)], ["recent"])
        self.assertEqual(archive[-1]["last_observed_at"], "2026-09-18")

    def test_recent_page_budget_is_not_silent_truncation(self):
        with self.assertRaisesRegex(RuntimeError, "budget exhausted"):
            fetch_pages(lambda path, params: {"data": [post(1, "2026-09-01T12:00:00Z")], "paging": {"next": "url", "cursors": {"after": "next"}}}, "account", max_pages=1, cutoff=datetime(2026, 8, 19, tzinfo=timezone.utc))

    def test_daily_refresh_retains_seed_archive_and_keeps_recent_metrics(self):
        # Stub the network package: this integration test must never call Meta.
        with patch.dict(sys.modules, {"requests": types.ModuleType("requests")}):
            spec = importlib.util.spec_from_file_location("instagram_pull_test", Path(__file__).resolve().parents[2] / "scripts/instagram_pull.py")
            pull = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(pull)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pull.DATA_DIR = root / "data"
            pull.PROJECT_DIR = root
            seed = root / "src/lib/admin/analytics/legacy-snapshot.json"
            seed.parent.mkdir(parents=True)
            seed.write_text(json.dumps({"social": {"instagramPosts": [
                {"id": "old", "date": "2020-01-01T12:00:00+0000", "likes": 5, "comments": 1}],
                "instagramArchive": {"accountId": "123", "backfillComplete": True}}}))
            archive = pull.load_instagram_archive("123")
            self.assertEqual(archive["posts"][0]["id"], "old")
            with self.assertRaisesRegex(RuntimeError, "different account"):
                pull.load_instagram_archive("different")
            fresh = post("new", datetime.now(timezone.utc).isoformat(), likes=10)
            captured = []
            with patch.dict("os.environ", {"INSTAGRAM_ACCESS_TOKEN": "synthetic-only"}), \
                 patch.object(pull, "resolve_instagram_account", return_value={"ig_id": "123"}), \
                 patch.object(pull, "pull_instagram_profile", return_value={"id": "123", "followers_count": 100}), \
                 patch.object(pull, "pull_recent_instagram_media", return_value=[fresh]), \
                 patch.object(pull, "update_instagram_social_stats", side_effect=lambda profile, posts, at: captured.extend(posts)):
                pull.run_instagram()
            result = json.loads((pull.DATA_DIR / "instagram_media.json").read_text())
            stats = json.loads((pull.DATA_DIR / "instagram_stats.json").read_text())
            self.assertEqual({row["id"] for row in result["posts"]}, {"old", "new"})
            self.assertTrue(result["backfill_complete"])
            self.assertEqual(stats["recent_posts_30d"], 1)
            self.assertEqual(stats["avg_engagement_rate_30d"], 10)
            self.assertEqual([row["id"] for row in captured], ["new"])
            self.assertEqual(list(pull.DATA_DIR.glob("*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
