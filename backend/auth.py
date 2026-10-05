"""Dual-contact passwordless accounts. No development code is returned to clients."""
import hashlib
import hmac
import os
import re
import secrets
import time

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegistrationInput(BaseModel):
    email: EmailStr
    phone: str = Field(pattern=r"^\+[1-9][0-9]{7,14}$")
    consent: bool

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value):
        return re.sub(r"[\s()\-]", "", value) if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return str(value).casefold()

    @field_validator("consent")
    @classmethod
    def require_consent(cls, value):
        if not value:
            raise ValueError("Подтвердите согласие на обработку контактов для входа")
        return value


class VerificationInput(BaseModel):
    challenge_id: str = Field(min_length=20, max_length=100)
    sms_code: str = Field(pattern=r"^[0-9]{6}$")
    email_code: str = Field(pattern=r"^[0-9]{6}$")


def delivery_ready():
    return (len(os.getenv("AUTH_SECRET", "")) >= 32 and
            all(os.getenv(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "RESEND_API_KEY", "AUTH_EMAIL_FROM")) and
            bool(os.getenv("TWILIO_MESSAGING_SERVICE_SID") or os.getenv("TWILIO_FROM_NUMBER")))


def deliver_codes(phone, email, sms_code, email_code):
    """Only fixed HTTPS provider endpoints, with no contact or token in log messages."""
    sid = os.environ["TWILIO_ACCOUNT_SID"]
    data = {"To": phone, "Body": f"Qalqan: код входа {sms_code}. Действует 10 минут. Никому не сообщайте код."}
    if os.getenv("TWILIO_MESSAGING_SERVICE_SID"):
        data["MessagingServiceSid"] = os.environ["TWILIO_MESSAGING_SERVICE_SID"]
    else:
        data["From"] = os.environ["TWILIO_FROM_NUMBER"]
    try:
        with httpx.Client(timeout=15) as client:
            sms = client.post(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                              auth=(sid, os.environ["TWILIO_AUTH_TOKEN"]), data=data)
            sms.raise_for_status()
            mail = client.post("https://api.resend.com/emails",
                               headers={"Authorization": "Bearer " + os.environ["RESEND_API_KEY"]},
                               json={"from": os.environ["AUTH_EMAIL_FROM"], "to": [email],
                                     "subject": "Qalqan — код входа",
                                     "text": f"Код подтверждения почты: {email_code}\nДействует 10 минут. Никому не сообщайте код.\nЕсли вы не запрашивали вход, проигнорируйте письмо."})
            mail.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(502, "Не удалось отправить оба кода. Проверьте контакты и попробуйте позже.") from None


class AuthService:
    def __init__(self, db):
        self.db = db

    def init(self):
        with self.db.connection() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE, created_at BIGINT NOT NULL)")
            conn.execute("CREATE TABLE IF NOT EXISTS auth_sessions (session_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at BIGINT NOT NULL)")
            conn.execute("CREATE INDEX IF NOT EXISTS auth_sessions_user ON auth_sessions(user_id)")
            conn.execute("CREATE TABLE IF NOT EXISTS auth_challenges (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, sms_hash TEXT NOT NULL, email_hash TEXT NOT NULL, expires_at BIGINT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0)")

    def digest(self, value):
        return hmac.new(os.environ["AUTH_SECRET"].encode(), value.encode(), hashlib.sha256).hexdigest()

    def user(self, session_id):
        with self.db.connection() as conn:
            row = self.db.execute(conn, "SELECT u.id, u.email, u.phone FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.session_id=? AND s.expires_at>?", (session_id, int(time.time()))).fetchone()
        return {"id": row[0], "email": row[1], "phone": row[2]} if row else None

    def profile(self, user):
        durable = self.db.postgres or os.getenv('RENDER','').lower()!='true'
        ready = bool(delivery_ready()) and durable
        reason = 'Регистрация требует постоянной PostgreSQL. Проверка сообщений доступна без входа.' if not durable and delivery_ready() else None
        if user is None:
            return {"authenticated": False, "delivery_available": ready, 'unavailable_reason':reason}
        local, domain = user["email"].split("@", 1)
        return {"authenticated": True, "email": local[:1] + "***@" + domain,
                "phone": "+***" + user["phone"][-4:], "delivery_available": ready, 'unavailable_reason':reason}

    def start(self, payload, session_id, peer):
        if os.getenv('RENDER','').lower()=='true' and not self.db.postgres:
            raise HTTPException(503,'Регистрация требует постоянной PostgreSQL. Подключите DATABASE_URL сервиса.')
        if not delivery_ready():
            raise HTTPException(503, "Отправка кодов пока не подключена. Для регистрации нужны настроенные SMS и почтовый сервисы.")
        for key in ("auth-ip:"+peer, "auth-phone:"+payload.phone, "auth-email:"+str(payload.email)):
            allowed, retry = self.db.reserve(self.digest(key), 3, period=3600)
            if not allowed:
                raise HTTPException(429, "Лимит отправки кодов. Попробуйте позже.", headers={"Retry-After": str(retry)})
        challenge = secrets.token_urlsafe(32)
        sms_code, email_code = (f"{secrets.randbelow(1000000):06d}" for _ in range(2))
        while email_code==sms_code:
            email_code=f"{secrets.randbelow(1000000):06d}"
        now = int(time.time())
        with self.db.connection() as conn:
            self.db.execute(conn, "DELETE FROM auth_challenges WHERE expires_at<?", (now,))
            self.db.execute(conn, "DELETE FROM auth_sessions WHERE expires_at<?", (now,))
            self.db.execute(conn, "INSERT INTO auth_challenges (id,session_id,email,phone,sms_hash,email_hash,expires_at) VALUES (?,?,?,?,?,?,?)",
                            (challenge,session_id,str(payload.email),payload.phone,self.digest(challenge+":sms:"+sms_code),self.digest(challenge+":email:"+email_code),now+600))
        try:
            deliver_codes(payload.phone, str(payload.email), sms_code, email_code)
        except HTTPException:
            with self.db.connection() as conn:
                self.db.execute(conn, "DELETE FROM auth_challenges WHERE id=?", (challenge,))
            raise
        return {"challenge_id": challenge, "expires_in": 600,
                "message": "Коды переданы SMS-сервису и почтовому сервису. Введите оба кода; доставка может занять время."}

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
            sql = "SELECT email,phone,sms_hash,email_hash,expires_at,attempts FROM auth_challenges WHERE id=? AND session_id=?"
            row = self.db.execute(conn, sql + (" FOR UPDATE" if self.db.postgres else ""), (payload.challenge_id,session_id)).fetchone()
            if row is None or row[4] <= now:
                error = HTTPException(410, "Коды недоступны или истекли. Запросите новые коды в этом браузере.")
            elif row[5] >= 5:
                error = HTTPException(429, "Слишком много попыток. Запросите новые коды.")
            elif not (hmac.compare_digest(row[2],self.digest(payload.challenge_id+":sms:"+payload.sms_code)) and hmac.compare_digest(row[3],self.digest(payload.challenge_id+":email:"+payload.email_code))):
                self.db.execute(conn, "UPDATE auth_challenges SET attempts=attempts+1 WHERE id=?", (payload.challenge_id,))
                error = HTTPException(429 if row[5]+1>=5 else 400, "Не удалось подтвердить коды. Проверьте SMS и письмо; доступно не более 5 попыток.")
            else:
                if self.db.postgres:
                    # Serialize overlapping contact pairs, independent of challenge IDs.
                    for contact in sorted((row[0], row[1])):
                        key = int.from_bytes(hashlib.sha256(contact.encode()).digest()[:8], 'big', signed=True)
                        self.db.execute(conn, "SELECT pg_advisory_xact_lock(?)", (key,))
                found = self.db.execute(conn, "SELECT id,email,phone FROM users WHERE email=? OR phone=?", (row[0],row[1])).fetchall()
                if found and (len(found)!=1 or found[0][1]!=row[0] or found[0][2]!=row[1]):
                    error = HTTPException(409, "Эти контакты связаны с разными данными аккаунта. Для входа используйте исходную пару телефона и почты.")
                else:
                    uid = found[0][0] if found else secrets.token_hex(16)
                    if not found:
                        self.db.execute(conn, "INSERT INTO users VALUES (?,?,?,?)", (uid,row[0],row[1],now))
                    self.db.execute(conn, "UPDATE checks SET session_id=? WHERE session_id=?", ("account:"+uid,session_id))
                    self.db.execute(conn, "UPDATE feedback SET owner=? WHERE owner=?", ("account:"+uid,session_id))
                    self.db.execute(conn, "DELETE FROM checks WHERE session_id=? AND id NOT IN (SELECT id FROM checks WHERE session_id=? ORDER BY created_at DESC,id DESC LIMIT 200)", ("account:"+uid,"account:"+uid))
                    self.db.execute(conn, "DELETE FROM auth_sessions WHERE session_id=?", (session_id,))
                    self.db.execute(conn, "INSERT INTO auth_sessions VALUES (?,?,?)", (new_session,uid,now+86400*7))
                    self.db.execute(conn, "DELETE FROM auth_challenges WHERE id=?", (payload.challenge_id,))
                    user = {"id":uid,"email":row[0],"phone":row[1]}
        if error:
            raise error
        return self.profile(user), token

    def logout(self, session_id):
        with self.db.connection() as conn:
            self.db.execute(conn, "DELETE FROM auth_sessions WHERE session_id=?", (session_id,))

    def delete_account(self, user):
        with self.db.connection() as conn:
            self.db.execute(conn, "DELETE FROM checks WHERE session_id=?", ("account:"+user["id"],))
            self.db.execute(conn, "DELETE FROM feedback WHERE owner=?", ("account:"+user["id"],))
            self.db.execute(conn, "DELETE FROM auth_sessions WHERE user_id=?", (user["id"],))
            self.db.execute(conn, "DELETE FROM auth_challenges WHERE email=? OR phone=?", (user["email"],user["phone"]))
            self.db.execute(conn, "DELETE FROM users WHERE id=?", (user["id"],))
