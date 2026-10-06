"""Email-only passwordless accounts delivered through Resend."""
import hashlib
import hmac
import os
import secrets
import time

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegistrationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    consent: bool

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return str(value).casefold()

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value):
        if not value:
            raise ValueError("Подтвердите согласие на обработку почты для входа")
        return value


class VerificationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    challenge_id: str = Field(min_length=20, max_length=100)
    email_code: str = Field(pattern=r"^[0-9]{6}$")


def delivery_ready():
    return len(os.getenv("AUTH_SECRET", "")) >= 32 and all(
        os.getenv(k, "").strip() for k in ("RESEND_API_KEY", "AUTH_EMAIL_FROM"))


def deliver_code(email, email_code):
    """Fixed HTTPS endpoint; contacts, codes and provider responses are never logged."""
    try:
        with httpx.Client(timeout=15) as client:
            mail = client.post("https://api.resend.com/emails",
                               headers={"Authorization": "Bearer " + os.environ["RESEND_API_KEY"]},
                               json={"from": os.environ["AUTH_EMAIL_FROM"], "to": [email],
                                     "subject": "Qalqan — код входа",
                                     "text": f"Код подтверждения почты: {email_code}\nДействует 10 минут. Никому не сообщайте код.\nЕсли вы не запрашивали вход, проигнорируйте письмо."})
            mail.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(502, "Не удалось отправить письмо. Проверьте почту и попробуйте позже.") from None


class AuthService:
    def __init__(self, db):
        self.db = db

    def _columns(self, conn, table):
        # Only internal, fixed table names are passed here.
        if self.db.postgres:
            return {r[0] for r in self.db.execute(conn,
                "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?", (table,)).fetchall()}
        return {r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}

    def init(self):
        with self.db.connection() as conn:
            if self.db.postgres:
                conn.execute("SELECT pg_advisory_xact_lock(724519230)")
            else:
                conn.execute("BEGIN IMMEDIATE")
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL)")
            if "phone" in self._columns(conn, "users"):
                # Preserve account IDs, email identity and existing sessions/history;
                # remove previously collected phone numbers from the active schema.
                if self.db.postgres:
                    conn.execute("ALTER TABLE users DROP COLUMN phone")
                else:
                    conn.execute("CREATE TABLE users_email_migration (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL)")
                    conn.execute("INSERT INTO users_email_migration SELECT id,email,created_at FROM users")
                    conn.execute("DROP TABLE users")
                    conn.execute("ALTER TABLE users_email_migration RENAME TO users")
            conn.execute("CREATE TABLE IF NOT EXISTS auth_sessions (session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at BIGINT NOT NULL)")
            conn.execute("CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id)")
            if "phone" in self._columns(conn, "auth_challenges"):
                # Old two-code challenges cannot authenticate using one factor.
                conn.execute("DROP TABLE auth_challenges")
            conn.execute("CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, email TEXT NOT NULL, email_hash TEXT NOT NULL, expires_at BIGINT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)")

    def digest(self, value):
        return hmac.new(os.environ["AUTH_SECRET"].encode(), value.encode(), hashlib.sha256).hexdigest()

    def user(self, session_id):
        with self.db.connection() as conn:
            row = self.db.execute(conn, "SELECT u.id, u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_id=? AND s.expires_at>?", (session_id, int(time.time()))).fetchone()
        return {"id": row[0], "email": row[1]} if row else None

    def profile(self, user):
        durable = self.db.postgres or os.getenv("RENDER", "").lower() != "true"
        ready = bool(delivery_ready()) and durable
        reason = "Регистрация требует постоянной PostgreSQL. Проверка сообщений доступна без входа." if not durable else None
        if user is None:
            return {"authenticated": False, "delivery_available": ready, "unavailable_reason": reason}
        local, domain = user["email"].split("@", 1)
        return {"authenticated": True, "email": local[:1] + "***@" + domain,
                "delivery_available": ready, "unavailable_reason": reason}

    def start(self, payload, session_id, peer):
        if os.getenv("RENDER", "").lower() == "true" and not self.db.postgres:
            raise HTTPException(503, "Регистрация требует постоянной PostgreSQL. Подключите DATABASE_URL сервиса.")
        if not delivery_ready():
            raise HTTPException(503, "Отправка писем пока не подключена. Для входа настройте Resend и адрес отправителя.")
        for key in ("auth-ip:" + peer, "auth-email:" + str(payload.email)):
            allowed, retry = self.db.reserve(self.digest(key), 3, period=3600)
            if not allowed:
                raise HTTPException(429, "Лимит отправки кодов. Попробуйте позже.", headers={"Retry-After": str(retry)})
        challenge = secrets.token_urlsafe(32)
        email_code = f"{secrets.randbelow(1000000):06d}"
        now = int(time.time())
        with self.db.connection() as conn:
            self.db.execute(conn, "DELETE FROM auth_challenges WHERE expires_at<?", (now,))
            self.db.execute(conn, "DELETE FROM auth_sessions WHERE expires_at<?", (now,))
            self.db.execute(conn, "INSERT INTO auth_challenges (id,session_id,email,email_hash,expires_at) VALUES (?,?,?,?,?)",
                            (challenge, session_id, str(payload.email), self.digest(challenge + ":email:" + email_code), now + 600))
        try:
            deliver_code(str(payload.email), email_code)
        except HTTPException:
            with self.db.connection() as conn:
                self.db.execute(conn, "DELETE FROM auth_challenges WHERE id=?", (challenge,))
            raise
        return {"challenge_id": challenge, "expires_in": 600,
                "message": "Письмо передано почтовому сервису. Введите код из письма; доставка может занять время."}

    def verify(self, payload, session_id):
        if len(os.getenv("AUTH_SECRET", "")) < 32:
            raise HTTPException(503, "Подтверждение регистрации пока недоступно")
        now = int(time.time())
        error = None
        user = None
        token = secrets.token_hex(32)
        new_session = hashlib.sha256(token.encode()).hexdigest()
        with self.db.connection() as conn:
            if not self.db.postgres:
                conn.execute("BEGIN IMMEDIATE")
            sql = "SELECT email,email_hash,expires_at,attempts FROM auth_challenges WHERE id=? AND session_id=?"
            row = self.db.execute(conn, sql + (" FOR UPDATE" if self.db.postgres else ""), (payload.challenge_id, session_id)).fetchone()
            if row is None or row[2] <= now:
                error = HTTPException(410, "Код недоступен или истёк. Запросите новый код в этом браузере.")
            elif row[3] >= 5:
                error = HTTPException(429, "Слишком много попыток. Запросите новый код.")
            elif not hmac.compare_digest(row[1], self.digest(payload.challenge_id + ":email:" + payload.email_code)):
                self.db.execute(conn, "UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?", (payload.challenge_id,))
                error = HTTPException(429 if row[3] + 1 >= 5 else 400, "Не удалось подтвердить код. Проверьте письмо; доступно не более 5 попыток.")
            else:
                if self.db.postgres:
                    key = int.from_bytes(hashlib.sha256(row[0].encode()).digest()[:8], "big", signed=True)
                    self.db.execute(conn, "SELECT pg_advisory_xact_lock(?)", (key,))
                found = self.db.execute(conn, "SELECT id FROM users WHERE email=?", (row[0],)).fetchone()
                uid = found[0] if found else secrets.token_hex(16)
                if not found:
                    self.db.execute(conn, "INSERT INTO users (id,email,created_at) VALUES (?,?,?)", (uid, row[0], now))
                self.db.execute(conn, "UPDATE checks SET session_id=? WHERE session_id=?", ("account:" + uid, session_id))
                self.db.execute(conn, "UPDATE feedback SET owner=? WHERE owner=?", ("account:" + uid, session_id))
                self.db.execute(conn, "DELETE FROM checks WHERE session_id=? AND id NOT IN (SELECT id FROM checks WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 200)", ("account:" + uid, "account:" + uid))
                self.db.execute(conn, "DELETE FROM auth_sessions WHERE session_id=?", (session_id,))
                self.db.execute(conn, "INSERT INTO auth_sessions VALUES (?,?,?)", (new_session, uid, now + 86400 * 7))
                self.db.execute(conn, "DELETE FROM auth_challenges WHERE id=?", (payload.challenge_id,))
                user = {"id": uid, "email": row[0]}
        if error:
            raise error
        return self.profile(user), token

    def logout(self, session_id):
        with self.db.connection() as conn:
            self.db.execute(conn, "DELETE FROM auth_sessions WHERE session_id=?", (session_id,))

    def delete_account(self, user):
        with self.db.connection() as conn:
            self.db.execute(conn, "DELETE FROM checks WHERE session_id=?", ("account:" + user["id"],))
            self.db.execute(conn, "DELETE FROM feedback WHERE owner=?", ("account:" + user["id"],))
            self.db.execute(conn, "DELETE FROM auth_sessions WHERE user_id=?", (user["id"],))
            self.db.execute(conn, "DELETE FROM auth_challenges WHERE email=?", (user["email"],))
            self.db.execute(conn, "DELETE FROM users WHERE id=?", (user["id"],))
