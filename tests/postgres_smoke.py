"""Optional real PostgreSQL integration, used in CI with an isolated database."""
import os
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.database import Database


def main():
    url = os.environ["TEST_DATABASE_URL"]
    app = create_app(url)
    with TestClient(app) as client:
        assert client.get("/api/health").json()["storage"] == "postgresql"
        result = client.post("/api/analyze", json={"content": "Введите CVV карты немедленно."})
        assert result.status_code == 200, result.text
        assert len(client.get("/api/history").json()["items"]) == 1
        assert client.get("/api/dashboard").json()["total"] == 1
        assert client.get(f"/api/reports/{result.json()['id']}.pdf").content.startswith(b"%PDF")
        token = client.cookies.get("qalqan_session")
        saved_id = result.json()["id"]
    # A newly created application shares no process-local session state.
    with TestClient(create_app(url)) as restarted:
        restarted.cookies.set("qalqan_session", token)
        assert restarted.get("/api/health").json()["history_persistence"] == "external_database"
        items = restarted.get("/api/history").json()["items"]
        assert len(items) == 1 and items[0]["id"] == saved_id
        assert restarted.get(f"/api/reports/{saved_id}.pdf").content.startswith(b"%PDF")
        assert restarted.delete("/api/history").status_code == 204
    databases=[Database(url),Database(url)]
    for db in databases: db.init()
    try:
        moment=time.time();key='integration-'+str(uuid4())
        with ThreadPoolExecutor(max_workers=8) as pool:
            allowed=list(pool.map(lambda i:databases[i%2].reserve(key,7,now=moment)[0],range(24)))
        assert sum(allowed)==7, allowed
        # Repeated queries borrow existing connections rather than opening a socket each time.
        pids=set()
        for _ in range(12):
            with databases[0].connection() as c: pids.add(c.execute('SELECT pg_backend_pid()').fetchone()[0])
        assert len(pids)<=5
    finally:
        for db in databases: db.close()
    from unittest.mock import patch
    import hashlib
    from backend.auth import AuthService, RegistrationInput, VerificationInput
    from tests.test_auth import CONFIG
    codes=[];identity=str(uuid4());email=identity+'@example.com';phone='+77'+str(int(uuid4().hex[:10],16)).zfill(11)[-9:]
    with patch.dict(os.environ,{**CONFIG,'RENDER':'false'}),patch('backend.auth.deliver_codes',side_effect=lambda p,e,s,m:codes.append((s,m))):
        db=Database(url);db.init();auth=AuthService(db);auth.init()
        try:
            sid=hashlib.sha256(identity.encode()).hexdigest()
            payload=RegistrationInput(email=email,phone=phone,consent=True)
            challenge=auth.start(payload,sid,identity)
            profile,token=auth.verify(VerificationInput(challenge_id=challenge['challenge_id'],sms_code=codes[-1][0],email_code=codes[-1][1]),sid)
            assert profile['authenticated']
            user=auth.user(hashlib.sha256(token.encode()).hexdigest());assert user and user['email']==email
            auth.delete_account(user)
            assert auth.user(hashlib.sha256(token.encode()).hexdigest()) is None
        finally:db.close()
    print("PostgreSQL integration passed: restart history/PDF, pooled connections and atomic quota across instances")


if __name__ == "__main__":
    main()
