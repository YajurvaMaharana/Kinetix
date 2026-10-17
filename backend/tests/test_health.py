from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


def test_health_api_v1():
    """
    Test GET /api/v1/health returns HTTP 200 with status, model_version, and policy_version.
    """
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_version"] == settings.MODEL_VERSION
    assert data["policy_version"] == settings.POLICY_VERSION


def test_health_root_alias():
    """
    Test GET /health alias endpoint returns HTTP 200.
    """
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "model_version" in data
    assert "policy_version" in data


def test_health_cors_headers():
    """
    Test CORS headers allow frontend origin http://localhost:3000.
    """
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
