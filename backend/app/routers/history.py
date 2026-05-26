"""
Router: /api/history and /api/dictionary
"""
import logging
from fastapi import APIRouter, Request, Depends, Query, HTTPException

from app.models import HistoryResponse, DictionaryRequest, DictionaryResponse
from app.middleware.rate_limiter import limiter
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


def get_supabase(request: Request):
    return request.app.state.supabase


def get_pipeline(request: Request):
    return request.app.state.pipeline


@router.get("/history", response_model=HistoryResponse)
@limiter.limit(settings.rate_limit_check)
async def get_history(
    request: Request,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase=Depends(get_supabase),
) -> HistoryResponse:
    """Return paginated correction history from Supabase."""
    return supabase.get_history(limit=limit, offset=offset)


@router.delete("/history")
@limiter.limit(settings.rate_limit_check)
async def clear_history(
    request: Request,
    supabase=Depends(get_supabase),
) -> dict:
    """Delete all correction history records."""
    if not supabase.available:
        return {"deleted": 0, "message": "Supabase not configured — nothing to delete."}
    deleted = supabase.clear_history()
    return {"deleted": deleted, "message": "History cleared."}


@router.post("/dictionary", response_model=DictionaryResponse)
@limiter.limit(settings.rate_limit_check)
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
    if supabase.available:
        supabase.add_custom_words(body.words)

    all_words = supabase.get_custom_words() if supabase.available else body.words
    return DictionaryResponse(words=all_words, total=len(all_words))


@router.get("/dictionary", response_model=DictionaryResponse)
@limiter.limit(settings.rate_limit_check)
async def get_dictionary_words(
    request: Request,
    supabase=Depends(get_supabase),
) -> DictionaryResponse:
    """Return the custom dictionary words."""
    words = supabase.get_custom_words() if supabase.available else []
    return DictionaryResponse(words=words, total=len(words))


@router.delete("/dictionary/{word}")
@limiter.limit(settings.rate_limit_check)
async def remove_dictionary_word(
    word: str,
    request: Request,
    supabase=Depends(get_supabase),
    pipeline=Depends(get_pipeline),
) -> dict:
    """Remove a word from the custom dictionary."""
    clean = word.strip().lower()
    if not clean:
        raise HTTPException(status_code=400, detail="Word cannot be empty.")

    # Remove from Supabase if available
    if supabase.available:
        supabase.remove_custom_word(clean)

    # Note: the in-memory spell checker (pyspellchecker) does not support
    # removing words once added — a restart is needed for full effect.
    return {"word": clean, "message": "Word removed from dictionary."}
