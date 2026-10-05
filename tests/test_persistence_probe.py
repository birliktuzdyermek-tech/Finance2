import json
import os
import tempfile
import unittest
from pathlib import Path

import httpx
from scripts.verify_persistence import record, verify


class PersistenceProbeTests(unittest.TestCase):
    def test_roundtrip_requires_changed_deployment_and_keeps_cookie_private(self):
        instance = {"id": "old"}
        def handler(request):
            if request.url.path == "/api/health":
                return httpx.Response(200, json={"storage": "postgresql", "deployment": {"instance": instance["id"], "commit": "same"}})
            if request.url.path == "/api/analyze":
                return httpx.Response(200, json={"id": "demo-id"}, headers={"set-cookie": "qalqan_session=test-session; HttpOnly"})
            self.assertIn("qalqan_session=test-session", request.headers.get("cookie", ""))
            if request.url.path == "/api/history":
                return httpx.Response(200, json={"items": [{"id": "demo-id"}]})
            return httpx.Response(200, content=b"%PDF-demo")
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "probe.json"
            with httpx.Client(base_url="https://demo.example", transport=httpx.MockTransport(handler)) as client:
                record(client, state)
                self.assertEqual(os.stat(state).st_mode & 0o777, 0o600)
                with self.assertRaisesRegex(RuntimeError, "No changed"):
                    verify(client, state)
            instance["id"] = "new"
            with httpx.Client(base_url="https://demo.example", transport=httpx.MockTransport(handler)) as new_client:
                verify(new_client, state)

    def test_sqlite_does_not_claim_persistence(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "probe.json"
            with httpx.Client(base_url="https://demo.example", transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"storage": "sqlite"}))) as client:
                with self.assertRaisesRegex(RuntimeError, "PostgreSQL is not connected"):
                    record(client, state)
            self.assertFalse(state.exists())

    def test_history_loss_is_detected_after_changed_instance(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "probe.json"
            state.write_text(json.dumps({"base_url": "https://demo.example", "check_id": "missing", "session_cookie": "token", "deployment": {"instance": "old"}}))
            def handler(request):
                if request.url.path == "/api/health":
                    return httpx.Response(200, json={"storage": "postgresql", "deployment": {"instance": "new"}})
                return httpx.Response(200, json={"items": []})
            with httpx.Client(base_url="https://demo.example", transport=httpx.MockTransport(handler)) as client:
                with self.assertRaisesRegex(RuntimeError, "missing after redeploy"):
                    verify(client, state)
