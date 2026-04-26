from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SERVER_PATH = ROOT / "custerfix-ui" / "server.py"

spec = importlib.util.spec_from_file_location("clusterfix_ui_server", SERVER_PATH)
server_module = importlib.util.module_from_spec(spec)
assert spec is not None and spec.loader is not None
spec.loader.exec_module(server_module)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(server_module, "GEMINI_API_KEY", "")
    for key in list(server_module._METRICS.keys()):
        server_module._METRICS[key] = 0
    app = server_module.app
    app.config["TESTING"] = True
    with app.test_client() as test_client:
        yield test_client


def test_health_endpoint_returns_runtime_flags(client) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")

    payload = response.get_json()
    assert payload["status"] == "ok"
    assert payload["service"] == "clusterfix-ui-backend"
    assert payload["request_id"]
    assert isinstance(payload["provider_configured"], bool)
    assert isinstance(payload["model_assist_enabled"], bool)


def test_metrics_endpoint_reports_counters(client) -> None:
    client.get("/api/health")
    response = client.get("/api/metrics")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")

    payload = response.get_json()
    assert payload["status"] == "ok"
    assert payload["service"] == "clusterfix-ui-backend"
    assert isinstance(payload["uptime_seconds"], int)
    assert payload["metrics"]["requests_total"] >= 2
    assert "solve_requests" in payload["metrics"]


def test_solve_rejects_non_json_body(client) -> None:
    response = client.post("/api/solve", data="plain text", content_type="text/plain")
    assert response.status_code == 400
    assert response.headers.get("X-Request-ID")
    assert response.get_json()["status"] == "error"
    assert "JSON object" in response.get_json()["error"]


def test_solve_rejects_non_object_json(client) -> None:
    response = client.post("/api/solve", json=["not", "an", "object"])
    assert response.status_code == 400
    assert response.get_json()["status"] == "error"
    assert "JSON object" in response.get_json()["error"]


def test_solve_rejects_empty_ticket(client) -> None:
    response = client.post("/api/solve", json={"ticket": "   "})
    assert response.status_code == 400
    assert response.get_json()["status"] == "error"
    assert "required" in response.get_json()["error"]


def test_solve_rejects_ticket_over_limit(client) -> None:
    response = client.post("/api/solve", json={"ticket": "a" * 5001})
    assert response.status_code == 400
    assert response.get_json()["status"] == "error"
    assert "max length" in response.get_json()["error"]


def test_solve_accepts_valid_payload(client) -> None:
    response = client.post(
        "/api/solve",
        json={
            "ticket": "Database timeout on checkout service",
            "context": "prod cluster",
            "logs": "sql timeout error and pod restarts",
            "metrics": "cpu 85, error rate 12%",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")

    payload = response.get_json()
    assert payload["request_id"]
    assert payload["summary"]
    assert payload["category"]
    assert "confidence" in payload
