"""
Supabase client service for storing correction history and custom dictionary.
Gracefully degrades if Supabase is not configured.
"""
import logging
from typing import Any
from datetime import datetime, timezone
from app.models import CorrectionRecord, HistoryResponse

logger = logging.getLogger(__name__)


class SupabaseService:
    def __init__(self, url: str = "", key: str = "") -> None:
        self._client: Any | None = None
        if url and key:
            try:
                from supabase import create_client  # type: ignore

                self._client = create_client(url, key)
                logger.info("Supabase client initialized.")
            except Exception as exc:
                logger.warning(f"Supabase unavailable: {exc}")

    @property
    def available(self) -> bool:
        return self._client is not None

    # ── Correction History ────────────────────────────────────────────────

    def save_correction(
        self,
        original_text: str,
        corrected_text: str,
        errors_count: int,
        error_types: dict[str, int],
    ) -> CorrectionRecord | None:
        if not self.available:
            return None
        try:
            client = self._client
            assert client is not None
            data = {
                "original_text": original_text,
                "corrected_text": corrected_text,
                "errors_count": errors_count,
                "error_types": error_types,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            result = client.table("correction_history").insert(data).execute()
            if result.data:
                row = result.data[0]
                return CorrectionRecord(**row)
        except Exception as exc:
            logger.error(f"Failed to save correction: {exc}")
        return None

    def get_history(self, limit: int = 50, offset: int = 0) -> HistoryResponse:
        if not self.available:
            return HistoryResponse(records=[], total=0)
        try:
            client = self._client
            assert client is not None
            result = (
                client.table("correction_history")
                .select("*", count="exact")
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            records = [CorrectionRecord(**r) for r in (result.data or [])]
            total = result.count or len(records)
            return HistoryResponse(records=records, total=total)
        except Exception as exc:
            logger.error(f"Failed to fetch history: {exc}")
            return HistoryResponse(records=[], total=0)

    # ── Custom Dictionary ─────────────────────────────────────────────────

    def get_custom_words(self) -> list[str]:
        if not self.available:
            return []
        try:
            client = self._client
            assert client is not None
            result = client.table("custom_dictionary").select("word").execute()
            return [r["word"] for r in (result.data or [])]
        except Exception as exc:
            logger.error(f"Failed to fetch dictionary: {exc}")
            return []

    def add_custom_words(self, words: list[str]) -> list[str]:
        if not self.available:
            return []
        try:
            rows = [{"word": w.strip().lower()} for w in words if w.strip()]
            client = self._client
            assert client is not None
            result = (
                client.table("custom_dictionary")
                .upsert(rows, on_conflict="word")
                .execute()
            )
            return [r["word"] for r in (result.data or [])]
        except Exception as exc:
            logger.error(f"Failed to add words: {exc}")
            return []

    def clear_history(self) -> int:
        """Delete all correction history records. Returns number of deleted rows."""
        if not self.available:
            return 0
        try:
            client = self._client
            assert client is not None
            result = (
                client.table("correction_history")
                .delete()
                .neq("id", 0)  # delete all rows
                .execute()
            )
            return len(result.data or [])
        except Exception as exc:
            logger.error(f"Failed to clear history: {exc}")
            return 0

    def remove_custom_word(self, word: str) -> bool:
        """Remove a single word from the custom dictionary. Returns True if found."""
        if not self.available:
            return False
        try:
            client = self._client
            assert client is not None
            client.table("custom_dictionary").delete().eq("word", word.lower()).execute()
            return True
        except Exception as exc:
            logger.error(f"Failed to remove word '{word}': {exc}")
            return False

