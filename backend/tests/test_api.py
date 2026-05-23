"""Integration tests for FastAPI endpoints."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.main import create_app
from app.models import CheckResponse, CorrectResponse, ErrorSuggestion
from app.nlp.pipeline import NLPPipeline
from app.services.supabase_client import SupabaseService


@pytest.fixture
def mock_pipeline():
    """Pipeline that returns a predictable response."""
    pipeline = MagicMock(spec=NLPPipeline)
    pipeline.spell_checker = MagicMock()
    pipeline.grammar_checker = MagicMock()
    pipeline.grammar_checker.available = False
    pipeline.context_model = MagicMock()
    pipeline.context_model.available = False

    error = ErrorSuggestion(
        offset=2,
        length=3,
        original="hav",
        suggestions=["have"],
        error_type="spelling",
        message='"hav" may be misspelled.',
        rule_id="SPELL_CHECK",
    )
    pipeline.check.return_value = CheckResponse(
        original_text="I hav a dog",
        errors=[error],
        corrected_text="I have a dog",
        error_counts={"spelling": 1},
    )
    pipeline.correct.return_value = CorrectResponse(
        original_text="I hav a dog",
        corrected_text="I have a dog",
        changes_made=1,
    )
    return pipeline


@pytest.fixture
def client(mock_pipeline):
    app = create_app()

    # Override app state after creation
    with TestClient(app) as c:
        app.state.pipeline = mock_pipeline
        app.state.supabase = SupabaseService()  # no credentials — no-op
        yield c


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_check_endpoint(client, mock_pipeline):
    response = client.post("/api/check", json={"text": "I hav a dog"})
    assert response.status_code == 200
    data = response.json()
    assert data["original_text"] == "I hav a dog"
    assert len(data["errors"]) == 1
    assert data["errors"][0]["error_type"] == "spelling"
    assert "have" in data["errors"][0]["suggestions"]


def test_correct_endpoint(client):
    response = client.post("/api/correct", json={"text": "I hav a dog"})
    assert response.status_code == 200
    data = response.json()
    assert data["corrected_text"] == "I have a dog"
    assert data["changes_made"] == 1


def test_check_empty_text(client):
    response = client.post("/api/check", json={"text": ""})
    assert response.status_code == 422  # Validation error


def test_check_too_long_text(client):
    response = client.post("/api/check", json={"text": "a" * 10001})
    assert response.status_code == 422


def test_history_endpoint(client):
    response = client.get("/api/history")
    assert response.status_code == 200
    data = response.json()
    assert "records" in data
    assert "total" in data


def test_dictionary_get(client):
    response = client.get("/api/dictionary")
    assert response.status_code == 200


def test_dictionary_post(client):
    response = client.post("/api/dictionary", json={"words": ["supabase", "fastapi"]})
    assert response.status_code == 200
