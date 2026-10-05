import hashlib
import json
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from ai.model import ROOT, load_model
from backend.analyzer import analyze
from backend.database import Database
from backend.reports import make_pdf


class AnalysisInput(BaseModel):
    content: str = Field(min_length=3, max_length=10000)
    channel: Literal["sms", "whatsapp", "email", "url"] = "sms"

    @field_validator("content")
    @classmethod
    def nonempty(cls, value):
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Введите минимум 3 символа")
        return value


class BodyLimit:
    def __init__(self, app, limit=65536):
        self.app, self.limit = app, limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in ("POST", "PUT", "PATCH"):
            return await self.app(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > self.limit:
                return await JSONResponse({"detail": "Тело запроса слишком большое"}, status_code=413)(scope, receive, send)
            chunks.append(message.get("body", b""))
            if not message.get("more_body"):
                break
        replayed = False
        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()
        await self.app(scope, replay, send)


def create_app(database_url=None):
    db = Database(database_url)
    lock = threading.Lock()
    buckets = defaultdict(deque)
    rate_limit = int(os.getenv("RATE_LIMIT", "30"))

    @asynccontextmanager
    async def lifespan(app):
        db.init()
        load_model()
        yield

    app = FastAPI(title="Qalqan Finance Security", version="0.1.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.add_middleware(BodyLimit)

    @app.middleware("http")
    async def session_and_headers(request: Request, call_next):
        token = request.cookies.get("qalqan_session", "")
        fresh = len(token) != 64 or any(c not in "0123456789abcdef" for c in token)
        if fresh:
            token = secrets.token_hex(32)
        request.state.session_id = hashlib.sha256(token.encode()).hexdigest()
        if request.method in ("POST", "DELETE", "PUT", "PATCH"):
            origin = request.headers.get("origin")
            expected = os.getenv("PUBLIC_ORIGIN", str(request.base_url).rstrip("/"))
            if (origin and origin.rstrip("/") != expected.rstrip("/")) or request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"detail": "Cross-origin requests are forbidden"}, status_code=403)
            now = time.monotonic()
            # Limit by peer IP, not by attacker-controlled cookie. One worker MVP.
            peer = request.client.host if request.client else "unknown"
            with lock:
                for key in list(buckets):
                    if not buckets[key] or buckets[key][-1] < now - 60:
                        del buckets[key]
                bucket = buckets[peer]
                while bucket and bucket[0] < now - 60:
                    bucket.popleft()
                if len(bucket) >= rate_limit:
                    return JSONResponse({"detail": "Лимит проверок. Повторите через минуту."}, status_code=429, headers={"Retry-After": "60"})
                bucket.append(now)
        response = await call_next(request)
        if fresh:
            response.set_cookie("qalqan_session", token, httponly=True, secure=os.getenv("COOKIE_SECURE", "false").lower() == "true", samesite="strict", max_age=86400 * 7)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health")
    def health():
        with db.connection() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "model": "synthetic-char-tfidf-lr-v1", "storage": "postgresql" if db.postgres else "sqlite"}

    @app.post("/api/analyze")
    def check(payload: AnalysisInput, request: Request):
        result = analyze(payload.content, payload.channel)
        now = datetime.now(timezone.utc)
        result.update(id=str(uuid4()), created_at=now.isoformat(), expires_before=(now - timedelta(days=7)).isoformat())
        db.save(request.state.session_id, result)
        result.pop("expires_before")
        return result

    @app.get("/api/history")
    def history(request: Request):
        return {"items": db.history(request.state.session_id)}

    @app.delete("/api/history", status_code=204)
    def clear_history(request: Request):
        db.clear(request.state.session_id)
        return Response(status_code=204)

    @app.get("/api/dashboard")
    def dashboard(request: Request):
        items = db.history(request.state.session_id)
        counts = {v: sum(i["verdict"] == v for i in items) for v in ("low", "suspicious", "high")}
        types = defaultdict(int)
        daily = defaultdict(int)
        for item in items:
            daily[item["created_at"][:10]] += 1
            for signal in item["signals"]:
                types[signal["title"]] += 1
        return {"total": len(items), "counts": counts, "average_ms": round(sum(i["duration_ms"] for i in items) / max(1, len(items)), 2),
                "types": sorted(types.items(), key=lambda i: -i[1]), "daily": sorted(daily.items())}

    @app.get("/api/reports/{check_id}.pdf")
    def report(check_id: str, request: Request):
        item = db.get(request.state.session_id, check_id)
        if item is None:
            raise HTTPException(404, "Отчёт не найден")
        return Response(make_pdf(item), media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="qalqan-report.pdf"'})

    @app.get("/api/metrics")
    def metrics():
        path = ROOT / "ai/evaluation/metrics.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"status": "not_evaluated"}

    @app.head("/", include_in_schema=False)
    @app.get("/")
    def index():
        return FileResponse(ROOT / "frontend/index.html")

    @app.get("/docs", include_in_schema=False)
    def api_docs():
        return FileResponse(ROOT / "frontend/api.html")

    app.mount("/static", StaticFiles(directory=ROOT / "frontend"), name="static")
    return app


app = create_app()
