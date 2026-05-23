"""
Router: /api/history and /api/dictionary
"""
import logging
from fastapi import APIRouter, Request, Depends, Query
from slowapi import Limiter  # type: ignore

from app.models import HistoryResponse, DictionaryRequest, DictionaryResponse
from app.middleware.rate_limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


def get_supabase(request: Request):
    return request.app.state.supabase


def get_pipeline(request: Request):
    return request.app.state.pipeline


@router.get("/history", response_model=HistoryResponse)
@limiter.limit("30/minute")
async def get_history(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase=Depends(get_supabase),
) -> HistoryResponse:
    """Return paginated correction history from Supabase."""
    return supabase.get_history(limit=limit, offset=offset)


@router.post("/dictionary", response_model=DictionaryResponse)
@limiter.limit("30/minute")
async def add_dictionary_words(
    request: Request,
    body: DictionaryRequest,
    supabase=Depends(get_supabase),
    pipeline=Depends(get_pipeline),
) -> DictionaryResponse:
    """Add words to the custom dictionary (persisted in Supabase + in-memory)."""
    # Add to in-memory spell checker immediately
    pipeline.spell_checker.add_words(body.words)

    # Persist to Supabase if available
    saved = supabase.add_custom_words(body.words) if supabase.available else body.words

    all_words = supabase.get_custom_words() if supabase.available else body.words
    return DictionaryResponse(words=all_words, total=len(all_words))


@router.get("/dictionary", response_model=DictionaryResponse)
@limiter.limit("30/minute")
async def get_dictionary_words(
    request: Request,
    supabase=Depends(get_supabase),
) -> DictionaryResponse:
    """Return the custom dictionary words."""
    words = supabase.get_custom_words() if supabase.available else []
    return DictionaryResponse(words=words, total=len(words))
