from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from openai import OpenAIError

from app.main import app

client = TestClient(app)

VALID_ROUTE_PAYLOAD = {
    "route": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "request_id": "660e8400-e29b-41d4-a716-446655440001",
        "status": "FINISHED",
        "description": "Rota administrativa concluída com sucesso.",
        "started_at": "2026-11-24T10:00:00Z",
        "finished_at": "2026-11-24T11:30:00Z",
    },
    "request": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "user_id": "22222222-3333-4444-8555-666666666666",
        "vehicle_id": "33333333-4444-4555-8666-777777777777",
        "status": "COMPLETED",
        "predicted_start_date": "2026-11-24T10:00:00Z",
        "predicted_end_date": "2026-11-24T12:00:00Z",
        "reason": "Transporte de equipamentos entre campi IFRN",
    },
    "vehicle": {
        "id": "33333333-4444-4555-8666-777777777777",
        "plate": "ABC1D23",
        "model": "Fiat Cronos",
        "year": 2024,
        "odometer": 15420,
        "status": "AVAILABLE",
        "type": "CAR",
    },
    "user": {
        "id": "22222222-3333-4444-8555-666666666666",
        "name": "Motorista Teste",
        "department": "TI",
        "role": "DRIVER",
    },
    "tracks": [
        {
            "id": "770e8400-e29b-41d4-a716-446655440001",
            "route_id": "550e8400-e29b-41d4-a716-446655440000",
            "latitude": -5.812759,
            "longitude": -35.211,
            "captured_at": "2026-11-24T10:15:00Z",
        },
        {
            "id": "770e8400-e29b-41d4-a716-446655440002",
            "route_id": "550e8400-e29b-41d4-a716-446655440000",
            "latitude": -5.8201,
            "longitude": -35.205,
            "captured_at": "2026-11-24T11:15:00Z",
        },
    ],
    "extra_context": "Teste automatizado TC-AI-001",
    "metadata": {"source": "core-service", "report_type": "route"},
}


def test_tc_ai_001_generate_route_report_success():
    """TC-AI-001: IA simulada devuelve markdown válido -> HTTP 200 con markdown_content no vacío."""
    simulated_markdown = "# Relatório da Rota\n\n## Resumo Executivo\nOperação concluída normalmente."

    with patch("app.services.openai_service.client.responses.create") as mock_create:
        mock_create.return_value = SimpleNamespace(output_text=f"  {simulated_markdown}  \n")

        response = client.post("/reports/routes", json=VALID_ROUTE_PAYLOAD)

        assert response.status_code == 200
        body = response.json()
        assert "markdown_content" in body
        assert body["markdown_content"] == simulated_markdown
        assert len(body["markdown_content"]) > 0
        mock_create.assert_called_once()


def test_tc_ai_002a_invalid_payload_does_not_call_ai():
    """TC-AI-002 (a): Payload sin estructura válida es rechazado antes de invocar al cliente de IA."""
    with patch("app.services.openai_service.client.responses.create") as mock_create:
        response = client.post("/reports/routes", json={"route": {"id": "not-complete"}})

        assert response.status_code == 422
        mock_create.assert_not_called()


def test_tc_ai_002b_ai_unavailable_returns_502_according_to_contract():
    """TC-AI-002 (b): Cuando el proveedor de IA falla (503/OpenAIError), ai-service responde HTTP 502 conforme al contrato."""
    with patch("app.services.openai_service.client.responses.create") as mock_create:
        mock_create.side_effect = OpenAIError("503 Service Unavailable - upstream AI model overloaded")

        response = client.post("/reports/routes", json=VALID_ROUTE_PAYLOAD)

        assert response.status_code == 502
        body = response.json()
        assert body["detail"] == "Não foi possível gerar o relatório com a IA."
        mock_create.assert_called_once()


def test_tc_ai_002b_empty_ai_output_returns_502_without_partial_report():
    """TC-AI-002 (b): Si la IA devuelve texto vacío, responde HTTP 502 y no entrega contenido parcial."""
    with patch("app.services.openai_service.client.responses.create") as mock_create:
        mock_create.return_value = SimpleNamespace(output_text="   ")

        response = client.post("/reports/routes", json=VALID_ROUTE_PAYLOAD)

        assert response.status_code == 502
        assert response.json()["detail"] == "A IA retornou um relatório vazio."


VALID_FLEET_PAYLOAD = {
    "period": {"start": "2026-11-01", "end": "2026-11-27"},
    "users": [VALID_ROUTE_PAYLOAD["user"]],
    "vehicles": [VALID_ROUTE_PAYLOAD["vehicle"]],
    "requests": [VALID_ROUTE_PAYLOAD["request"]],
    "routes": [VALID_ROUTE_PAYLOAD["route"]],
    "extra_context": "Teste de regressão INC-ANDY-001",
    "metadata": {"source": "core-service", "report_type": "fleet"},
}


def test_inc_andy_001_fleet_report_endpoint_returns_200():
    """Regresión INC-ANDY-001: POST /reports/fleet ahora existe en ai-service y responde HTTP 200 con markdown."""
    simulated_markdown = "# Relatório Consolidado da Frota\n\n- Total de veículos: 1"

    with patch("app.services.openai_service.client.responses.create") as mock_create:
        mock_create.return_value = SimpleNamespace(output_text=simulated_markdown)

        response = client.post("/reports/fleet", json=VALID_FLEET_PAYLOAD)

        assert response.status_code == 200
        assert response.json() == {"markdown_content": simulated_markdown}
        mock_create.assert_called_once()


def test_inc_andy_001_fleet_report_invalid_payload_returns_422_without_ai_call():
    """Regresión INC-ANDY-001: Payload inválido en POST /reports/fleet devuelve 422 sin llamar a la IA."""
    with patch("app.services.openai_service.client.responses.create") as mock_create:
        response = client.post("/reports/fleet", json={"vehicles": "not-a-list"})

        assert response.status_code == 422
        mock_create.assert_not_called()


def test_inc_andy_001_fleet_report_ai_unavailable_returns_502():
    """Regresión INC-ANDY-001: Fallo del proveedor IA en POST /reports/fleet devuelve HTTP 502."""
    with patch("app.services.openai_service.client.responses.create") as mock_create:
        mock_create.side_effect = OpenAIError("503 Service Unavailable")

        response = client.post("/reports/fleet", json=VALID_FLEET_PAYLOAD)

        assert response.status_code == 502
        assert response.json()["detail"] == "Não foi possível gerar o relatório com a IA."
