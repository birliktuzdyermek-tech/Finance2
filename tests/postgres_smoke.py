"""Optional real PostgreSQL integration, used in CI with an isolated database."""
import os
from fastapi.testclient import TestClient
from backend.main import create_app


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
    print("PostgreSQL integration passed, including history/PDF after application recreation")


if __name__ == "__main__":
    main()
