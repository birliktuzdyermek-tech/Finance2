import hashlib
import json
import os
import secrets
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from starlette.concurrency import run_in_threadpool

from ai.model import ROOT, load_model
from backend.analyzer import analyze
from backend.database import Database
from backend.reports import make_pdf
from backend.auth import AuthService, RegistrationInput, VerificationInput


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


class BatchInput(BaseModel):
    items: list[AnalysisInput] = Field(min_length=1, max_length=10)


class FeedbackInput(BaseModel):
    vote: Literal['correct','incorrect']
    consent: bool

    @field_validator('consent')
    @classmethod
    def consent_required(cls,value):
        if not value:
            raise ValueError('Нужно явное согласие на сохранение отзыва')
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
    auth = AuthService(db)
    rate_limit = int(os.getenv("RATE_LIMIT", "30"))

    @asynccontextmanager
    async def lifespan(app):
        try:
            db.init()
            auth.init()
            load_model()
            yield
        finally:
            db.close()

    app = FastAPI(title="Qalqan Finance Security", version="0.2.0", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.add_middleware(BodyLimit)

    @app.middleware("http")
    async def session_and_headers(request: Request, call_next):
        token = request.cookies.get("qalqan_session", "")
        fresh = len(token) != 64 or any(c not in "0123456789abcdef" for c in token)
        if fresh:
            token = secrets.token_hex(32)
        request.state.session_id = hashlib.sha256(token.encode()).hexdigest()
        request.state.account = await run_in_threadpool(auth.user, request.state.session_id) if request.url.path.startswith('/api/') else None
        request.state.owner = "account:" + request.state.account["id"] if request.state.account else request.state.session_id
        peer = request.client.host if request.client else "unknown"
        request.state.rate_bucket = hashlib.sha256(peer.encode()).hexdigest()
        if request.method in ("POST", "DELETE", "PUT", "PATCH"):
            origin = request.headers.get("origin")
            expected = os.getenv("PUBLIC_ORIGIN") or os.getenv("RENDER_EXTERNAL_URL") or str(request.base_url).rstrip("/")
            if (origin and origin.rstrip("/") != expected.rstrip("/")) or request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"detail": "Cross-origin requests are forbidden"}, status_code=403)
            # Valid batch items reserve their quota in the endpoint after body validation.
            if request.url.path != "/api/analyze/batch":
                allowed, retry = await run_in_threadpool(db.reserve, request.state.rate_bucket, rate_limit)
                if not allowed:
                    return JSONResponse({"detail": "Лимит проверок. Повторите через минуту."}, status_code=429, headers={"Retry-After": str(retry), "Cache-Control": "no-store"})
        response = await call_next(request)
        issued = getattr(request.state, "new_session_token", None)
        if fresh or issued:
            response.set_cookie("qalqan_session", issued or token, httponly=True, secure=os.getenv("COOKIE_SECURE", "false").lower() == "true", samesite="strict", max_age=86400 * 7)
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
        on_render = os.getenv("RENDER", "").lower() == "true"
        return {"status": "ok", "model": "synthetic-char-tfidf-lr-v1",
                "storage": "postgresql" if db.postgres else "sqlite",
                "database_configured": db.configured,
                "history_persistence": "external_database" if db.postgres else "ephemeral" if on_render else "local_file",
                "limiter": "database_fixed_window", "batch_limit": 10,
                "connection_pool_max": 5 if db.postgres else None,
                "deployment": {"commit": os.getenv("RENDER_GIT_COMMIT"), "instance": os.getenv("RENDER_INSTANCE_ID")}}

    def make_result(payload):
        result = analyze(payload.content, payload.channel)
        now = datetime.now(timezone.utc)
        result.update(id=str(uuid4()), created_at=now.isoformat(), expires_before=(now - timedelta(days=7)).isoformat())
        return result

    @app.post("/api/analyze")
    def check(payload: AnalysisInput, request: Request):
        result = make_result(payload)
        db.save(request.state.owner, result)
        result.pop("expires_before")
        return result

    @app.post("/api/analyze/batch")
    def batch(payload: BatchInput, request: Request):
        allowed, retry = db.reserve(request.state.rate_bucket, rate_limit, cost=len(payload.items))
        if not allowed:
            raise HTTPException(429, "Лимит проверок. Уменьшите пакет или повторите через минуту.", headers={"Retry-After": str(retry)})
        results = [make_result(item) for item in payload.items]
        db.save_many(request.state.owner, results)
        for result in results:
            result.pop("expires_before")
        return {"items": results, "counts": {v: sum(i["verdict"] == v for i in results) for v in ("low", "suspicious", "high")}}

    @app.get("/api/history")
    def history(request: Request):
        return {"items": db.history(request.state.owner)}

    @app.delete("/api/history", status_code=204)
    def clear_history(request: Request):
        db.clear(request.state.owner)
        return Response(status_code=204)

    @app.get("/api/dashboard")
    def dashboard(request: Request):
        items = db.history(request.state.owner)
        counts = {v: sum(i["verdict"] == v for i in items) for v in ("low", "suspicious", "high")}
        types = defaultdict(int)
        daily = defaultdict(int)
        for item in items:
            daily[item["created_at"][:10]] += 1
            for signal in item["signals"]:
                types[signal["title"]] += 1
        schemes = defaultdict(int)
        for item in items:
            if item.get('scheme',{}).get('code','unknown')!='unknown':
                schemes[item['scheme']['title']]+=1
        return {"total": len(items), "counts": counts, "schemes":sorted(schemes.items(),key=lambda i:-i[1]), "channels": {c: sum(i["channel"] == c for i in items) for c in ("sms", "whatsapp", "email", "url")}, "average_ms": round(sum(i["duration_ms"] for i in items) / max(1, len(items)), 2),
                "types": sorted(types.items(), key=lambda i: -i[1]), "daily": sorted(daily.items())}

    @app.get("/api/reports/{check_id}.pdf")
    def report(check_id: str, request: Request):
        item = db.get(request.state.owner, check_id)
        if item is None:
            raise HTTPException(404, "Отчёт не найден")
        return Response(make_pdf(item), media_type="application/pdf", headers={"Content-Disposition": 'attachment; filename="qalqan-report.pdf"'})

    @app.get("/api/metrics")
    def metrics():
        path = ROOT / "ai/evaluation/metrics.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"status": "not_evaluated"}

    @app.get('/api/metrics/adversarial')
    def adversarial_metrics():
        path=ROOT/'ai/evaluation/adversarial.json'
        return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'status':'not_evaluated'}

    @app.post('/api/checks/{check_id}/feedback')
    def feedback(check_id: str, payload: FeedbackInput, request: Request):
        item=db.get(request.state.owner,check_id)
        if item is None:
            raise HTTPException(404,'Проверка не найдена')
        db.feedback(request.state.owner,item,payload.vote)
        return {'saved':True,'message':'Отзыв сохранён с признаками и доменами, без исходного сообщения.'}

    @app.get("/api/auth/me")
    def account(request: Request):
        return auth.profile(request.state.account)

    @app.post("/api/auth/start")
    def start_registration(payload: RegistrationInput, request: Request):
        return auth.start(payload, request.state.session_id, request.state.rate_bucket)

    @app.post("/api/auth/verify")
    def verify_registration(payload: VerificationInput, request: Request):
        profile, token = auth.verify(payload, request.state.session_id)
        request.state.new_session_token = token
        return profile

    @app.post("/api/auth/logout", status_code=204)
    def logout(request: Request):
        auth.logout(request.state.session_id)
        request.state.new_session_token = secrets.token_hex(32)
        return Response(status_code=204)

    @app.delete("/api/auth/account", status_code=204)
    def delete_account(request: Request):
        if request.state.account is None:
            raise HTTPException(401, "Сначала войдите в аккаунт")
        auth.delete_account(request.state.account)
        request.state.new_session_token = secrets.token_hex(32)
        return Response(status_code=204)

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
