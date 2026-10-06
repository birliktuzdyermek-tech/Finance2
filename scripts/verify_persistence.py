"""Two-step public deployment probe. Cookies stay in a local owner-only state file."""
import argparse
import json
import os
from pathlib import Path

import httpx


def require_postgres(client):
    response = client.get("/api/health")
    response.raise_for_status()
    health = response.json()
    if health.get("storage") != "postgresql":
        raise RuntimeError("PostgreSQL is not connected. Set DATABASE_URL in Render Environment before recording the probe.")
    return health


def record(client, state_path):
    health = require_postgres(client)
    if state_path.exists():
        raise RuntimeError("Probe state already exists. Verify the previous probe first or choose a new --state path.")
    response = client.post("/api/analyze", json={"content": "Проверка сохранности истории: обычное банковское уведомление.", "channel": "sms"})
    response.raise_for_status()
    token = client.cookies.get("qalqan_session")
    if not token:
        raise RuntimeError("The server did not issue a session cookie.")
    state = {"base_url": str(client.base_url).rstrip("/"), "check_id": response.json()["id"],
             "session_cookie": token, "deployment": health.get("deployment", {})}
    state_path.parent.mkdir(parents=True, exist_ok=True)
    descriptor = os.open(state_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as file:
        json.dump(state, file, ensure_ascii=False)
    print("Probe recorded. Redeploy the service, then run verify. The session cookie is stored locally and was not printed.")


def verify(client, state_path):
    state = json.loads(state_path.read_text(encoding="utf-8"))
    if str(client.base_url).rstrip("/") != state["base_url"]:
        raise RuntimeError("The probe was recorded for a different service URL.")
    client.cookies.set("qalqan_session", state["session_cookie"])
    health = require_postgres(client)
    previous, current = state.get("deployment", {}), health.get("deployment", {})
    changed = any(previous.get(key) and current.get(key) and previous[key] != current[key] for key in ("instance", "commit"))
    if not changed:
        raise RuntimeError("No changed Render instance or commit was observed. Redeploy before verifying persistence.")
    response = client.get("/api/history")
    response.raise_for_status()
    if state["check_id"] not in {item["id"] for item in response.json()["items"]}:
        raise RuntimeError("The recorded result is missing after redeploy.")
    report = client.get(f"/api/reports/{state['check_id']}.pdf")
    report.raise_for_status()
    if not report.content.startswith(b"%PDF"):
        raise RuntimeError("The restored result did not produce a valid PDF.")
    print("Persistence verified: changed deployment, original session history and PDF are available.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("record", "verify"))
    parser.add_argument("--base-url", default="https://qalqan-finance2.onrender.com")
    parser.add_argument("--state", type=Path, default=Path("data/persistence-probe.json"))
    args = parser.parse_args()
    url = httpx.URL(args.base_url)
    if url.scheme not in ("http", "https") or url.username or url.password:
        parser.error("Use a plain HTTP(S) service URL without credentials.")
    try:
        with httpx.Client(base_url=args.base_url, timeout=30, follow_redirects=True) as client:
            (record if args.mode == "record" else verify)(client, args.state)
    except (RuntimeError, OSError, ValueError, httpx.HTTPError) as error:
        if isinstance(error, RuntimeError):
            parser.exit(1, f"{error}\n")
        parser.exit(1, "The persistence probe failed. Check service health and the local state file.\n")


if __name__ == "__main__":
    main()
