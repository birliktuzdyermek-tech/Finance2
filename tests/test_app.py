import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from ai.model import rows
from backend.analyzer import analyze, inspect_url
from backend.main import create_app


class AnalyzerTests(unittest.TestCase):
    def test_bank_domain_boundary(self):
        for host in ("https://kaspi.kz", "https://pay.kaspi.kz", "https://KASPI.KZ./"):
            self.assertTrue(inspect_url(host)["official"])
        for host in ("https://kaspi.kz.evil.example", "https://notkaspi.kz", "https://kaspi.kz@evil.example", "https://kasp1.kz"):
            self.assertFalse(inspect_url(host)["official"])

    def test_impersonation_signal(self):
        signals = inspect_url("https://halykbank.kz.fake.example")["signals"]
        self.assertIn("impersonation", [s["code"] for s in signals])

    def test_url_is_never_opened(self):
        with patch("socket.getaddrinfo", side_effect=AssertionError("No DNS allowed")):
            result = analyze("http://192.0.2.1/pay", "url")
        self.assertIsNone(result["ml_score"])
        self.assertIn("ip_host", [s["code"] for s in result["signals"]])

    def test_message_risk_and_negation(self):
        bad = analyze("Срочно! Счёт заблокирован. Введите CVV и код из SMS.")
        self.assertEqual(bad["verdict"], "high")
        safe = analyze("Никогда не сообщайте код из SMS и CVV сотрудникам банка.")
        self.assertNotIn("secret_request", [s["code"] for s in safe["signals"]])

    def test_malformed_and_idn(self):
        self.assertEqual(inspect_url("http://[bad")["signals"][0]["code"], "malformed_url")
        self.assertIn("idn", [s["code"] for s in inspect_url("https://қаспи.kz")["signals"]])

    def test_split_has_no_group_or_exact_text_leakage(self):
        data = rows()
        train = [r for r in data if r["split"] == "train"]
        test = [r for r in data if r["split"] == "test"]
        self.assertFalse({r["group"] for r in train} & {r["group"] for r in test})
        self.assertFalse({r["text"] for r in train} & {r["text"] for r in test})
        for language in ("ru", "kz", "en"):
            self.assertEqual({r["label"] for r in test if r["language"] == language}, {"0", "1"})


class APITests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "checks.db"
        self.app = create_app("sqlite:///" + str(self.path))
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.directory.cleanup()

    def check(self, text="Срочно! Введите CVV карты."):
        return self.client.post("/api/analyze", json={"content": text, "channel": "sms"})

    def test_end_to_end_history_dashboard_and_delete(self):
        response = self.check()
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(len(self.client.get("/api/history").json()["items"]), 1)
        self.assertEqual(self.client.get("/api/dashboard").json()["total"], 1)
        self.assertEqual(self.client.delete("/api/history").status_code, 204)
        self.assertEqual(self.client.get("/api/history").json()["items"], [])
        self.assertEqual(self.client.get(f"/api/reports/{result['id']}.pdf").status_code, 404)

    def test_pdf_and_private_sessions(self):
        result = self.check().json()
        url = f"/api/reports/{result['id']}.pdf"
        report = self.client.get(url)
        self.assertEqual(report.status_code, 200)
        self.assertTrue(report.content.startswith(b"%PDF"))
        self.assertEqual(report.headers["content-type"], "application/pdf")
        with TestClient(self.app) as other:
            self.assertEqual(other.get("/api/history").json()["items"], [])
            self.assertEqual(other.get(url).status_code, 404)

    def test_no_raw_text_in_database(self):
        unique = "private-secret-84720931"
        self.check(f"Отправьте код из SMS {unique} https://example.com/?token={unique}")
        self.assertNotIn(unique.encode(), self.path.read_bytes())
        result = self.client.get("/api/history").json()["items"][0]
        self.assertEqual(result["urls"][0]["host"], "example.com")
        self.assertNotIn("content", result)

    def test_validation_and_body_limit(self):
        for content in ("", "   ", "x" * 10001):
            self.assertEqual(self.check(content).status_code, 422)
        self.assertEqual(self.client.post("/api/analyze", json={"content": "hello", "channel": "other"}).status_code, 422)
        self.assertEqual(self.client.post("/api/analyze", content="x" * 70000).status_code, 413)

    def test_origin_and_cookie_headers(self):
        response = self.client.get("/api/health")
        self.assertIn("HttpOnly", response.headers.get("set-cookie", ""))
        self.assertIn("SameSite=strict", response.headers.get("set-cookie", ""))
        self.assertIn("frame-ancestors 'none'", response.headers["content-security-policy"])
        blocked = self.client.post("/api/analyze", json={"content": "hello"}, headers={"Origin": "https://evil.example"})
        self.assertEqual(blocked.status_code, 403)

    def test_rate_limit_resists_cookie_rotation(self):
        with patch.dict(os.environ, {"RATE_LIMIT": "2"}):
            app = create_app("sqlite:///" + str(self.path))
        with TestClient(app) as client:
            for _ in range(2):
                self.assertEqual(client.post("/api/analyze", json={"content": "hello"}).status_code, 200)
                client.cookies.clear()
            self.assertEqual(client.post("/api/analyze", json={"content": "hello"}).status_code, 429)

    def test_static_and_openapi(self):
        for path in ("/", "/static/app.js", "/static/style.css", "/docs", "/openapi.json"):
            self.assertEqual(self.client.get(path).status_code, 200)


if __name__ == "__main__":
    unittest.main()
