"""
Router: POST /api/check and POST /api/correct
"""
import logging
from fastapi import APIRouter, Request, Depends
from slowapi import Limiter  # type: ignore
from slowapi.util import get_remote_address  # type: ignore

from app.models import CheckRequest, CheckResponse, CorrectRequest, CorrectResponse
from app.middleware.rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


def get_pipeline(request: Request):
    return request.app.state.pipeline


def get_supabase(request: Request):
    return request.app.state.supabase


@router.post("/check", response_model=CheckResponse)
@limiter.limit("30/minute")
def check_text(
    request: Request,
    body: CheckRequest,
    pipeline=Depends(get_pipeline),
    supabase=Depends(get_supabase),
) -> CheckResponse:
    """
    Check text for spelling, grammar, and contextual errors.
    Returns a list of errors with character offsets and suggestions.
    Uses regular `def` (not async) because NLP inference is CPU-bound.
    """
    result = pipeline.check(body.text)

    # Persist to Supabase if configured
    if supabase.available and result.errors:
        supabase.save_correction(
            original_text=result.original_text,
            corrected_text=result.corrected_text,
            errors_count=len(result.errors),
            error_types=result.error_counts,
        )

    return result


@router.post("/correct", response_model=CorrectResponse)
@limiter.limit("10/minute")
def correct_text(
    request: Request,
    body: CorrectRequest,
    pipeline=Depends(get_pipeline),
) -> CorrectResponse:
    """
    Return fully corrected text. Uses regular `def` — CPU-bound NLP work.
    """
    return pipeline.correct(body.text)
