import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.database import Database
from backend.main import create_app


class DatabaseConfigTests(unittest.TestCase):
    def test_missing_required_postgres_fails_without_silent_fallback(self):
        with patch.dict(os.environ, {"REQUIRE_POSTGRES": "true", "DATABASE_URL": ""}):
            with self.assertRaisesRegex(ValueError, "PostgreSQL is required"):
                Database()

    def test_database_url_whitespace_does_not_invalidate_provider_url(self):
        with patch.dict(os.environ, {"REQUIRE_POSTGRES": "true", "DATABASE_URL": "  postgresql://demo:secret@db:5432/demo \n"}):
            db = Database()
        self.assertTrue(db.postgres)
        self.assertTrue(db.configured)

    def test_render_local_storage_is_reported_as_ephemeral_without_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"RENDER": "true", "REQUIRE_POSTGRES": "false", "RENDER_INSTANCE_ID": "instance-a", "RENDER_GIT_COMMIT": "abc"}):
                with TestClient(create_app("sqlite:///" + str(Path(directory) / "checks.db"))) as client:
                    result = client.get("/api/health").json()
        self.assertEqual(result["history_persistence"], "ephemeral")
        self.assertEqual(result["deployment"], {"commit": "abc", "instance": "instance-a"})
        self.assertNotIn("url", result)

    def test_provider_origin_is_used_when_manual_origin_is_blank(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"PUBLIC_ORIGIN": "", "RENDER_EXTERNAL_URL": "https://qalqan.example", "REQUIRE_POSTGRES": "false"}):
                with TestClient(create_app("sqlite:///" + str(Path(directory) / "checks.db"))) as client:
                    response = client.post("/api/analyze", json={"content": "Обычное сообщение"}, headers={"Origin": "https://qalqan.example"})
                    foreign = client.post("/api/analyze", json={"content": "Обычное сообщение"}, headers={"Origin": "https://another.example"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(foreign.status_code, 403)
