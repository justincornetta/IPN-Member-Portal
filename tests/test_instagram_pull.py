import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "instagram_pull.py"
SPEC = importlib.util.spec_from_file_location("instagram_pull", MODULE_PATH)
instagram_pull = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(instagram_pull)


class MetaRefreshTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = instagram_pull.DATA_DIR
        instagram_pull.DATA_DIR = Path(self.temp_dir.name)

    def tearDown(self):
        instagram_pull.DATA_DIR = self.original_data_dir
        self.temp_dir.cleanup()

    def read_json(self, filename):
        return json.loads((Path(self.temp_dir.name) / filename).read_text())

    def test_platform_failure_does_not_overwrite_other_status(self):
        instagram_pull.save_json(
            "instagram_last_pull.json",
            {"status": "success", "last_pull": "2026-07-31T12:00:00+00:00"},
        )

        instagram_pull.record_pull_failure("facebook", RuntimeError("Page token required"))

        self.assertEqual(self.read_json("instagram_last_pull.json")["status"], "success")
        self.assertEqual(self.read_json("facebook_last_pull.json")["status"], "error")

    def test_facebook_follower_only_refresh_skips_posts_without_page_token(self):
        env = {
            "FACEBOOK_PAGE_ID": "page-1",
            "INSTAGRAM_ACCESS_TOKEN": "user-token",
        }
        profile = {
            "id": "page-1",
            "name": "IPN",
            "followers_count": 3200,
            "fan_count": 3100,
        }
        with patch.dict(os.environ, env, clear=True), patch.object(
            instagram_pull,
            "pull_facebook_page_profile",
            return_value=profile,
        ) as profile_pull, patch.object(
            instagram_pull,
            "pull_recent_facebook_posts",
        ) as posts_pull:
            instagram_pull.run_facebook()

        profile_pull.assert_called_once_with("user-token", "page-1")
        posts_pull.assert_not_called()
        status = self.read_json("facebook_last_pull.json")
        self.assertEqual(status["status"], "success")
        self.assertEqual(status["mode"], "follower_only")
        self.assertEqual(self.read_json("social_stats.json")["facebook"]["followers"], 3200)

    def test_daily_history_replaces_same_platform_date(self):
        profile = {"id": "ig-1", "username": "ipn", "followers_count": 100}
        instagram_pull.update_instagram_social_stats(
            profile,
            [],
            "2026-07-31T12:00:00+00:00",
        )
        profile["followers_count"] = 101
        instagram_pull.update_instagram_social_stats(
            profile,
            [],
            "2026-07-31T18:00:00+00:00",
        )

        history = self.read_json("social_stats.json")["history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["followers"], 101)


if __name__ == "__main__":
    unittest.main()
