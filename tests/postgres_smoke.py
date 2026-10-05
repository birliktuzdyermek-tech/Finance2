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
        assert client.delete("/api/history").status_code == 204
    print("PostgreSQL integration passed")


if __name__ == "__main__":
    main()
