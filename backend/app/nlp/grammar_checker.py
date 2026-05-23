"""
Grammar checker module using language-tool-python.
Wraps the LanguageTool local server to find grammar/style errors.
"""
import logging
from app.models import ErrorSuggestion

logger = logging.getLogger(__name__)

# Map LanguageTool categories to our error types
_CATEGORY_MAP: dict[str, str] = {
    "TYPOS": "spelling",
    "GRAMMAR": "grammar",
    "PUNCTUATION": "grammar",
    "STYLE": "context",
    "REDUNDANCY": "context",
    "CASING": "grammar",
    "CONFUSED_WORDS": "context",
    "COLLOCATIONS": "context",
    "MISC": "grammar",
}

# Rules to suppress (too noisy)
_BLOCKLIST_RULES = {
    "WHITESPACE_RULE",
    "COMMA_PARENTHESIS_WHITESPACE",
    "EN_QUOTES",
    "DASH_RULE",
}


class GrammarCheckerModule:
    def __init__(self) -> None:
        self._tool = None

    def initialize(self) -> None:
        """Initialize the LanguageTool server. Call once at startup."""
        try:
            import language_tool_python  # type: ignore

            logger.info("Starting LanguageTool local server…")
            self._tool = language_tool_python.LanguageTool("en-US")
            logger.info("LanguageTool ready.")
        except Exception as exc:
            logger.warning(f"LanguageTool unavailable: {exc}. Grammar checking disabled.")
            self._tool = None

    def shutdown(self) -> None:
        if self._tool is not None:
            try:
                self._tool.close()
            except Exception:
                pass

    @property
    def available(self) -> bool:
        return self._tool is not None

    def check(self, text: str) -> list[ErrorSuggestion]:
        """Return grammar errors with character offsets."""
        if not self.available:
            return []

        try:
            matches = self._tool.check(text)
        except Exception as exc:
            logger.error(f"LanguageTool check failed: {exc}")
            return []

        errors: list[ErrorSuggestion] = []
        for match in matches:
            rule_id = match.ruleId
            if rule_id in _BLOCKLIST_RULES:
                continue

            category = getattr(match, "category", "MISC") or "MISC"
            error_type = _CATEGORY_MAP.get(category.upper(), "grammar")

            errors.append(
                ErrorSuggestion(
                    offset=match.offset,
                    length=match.errorLength,
                    original=text[match.offset : match.offset + match.errorLength],
                    suggestions=list(match.replacements)[:5],
                    error_type=error_type,
                    message=match.message,
                    rule_id=rule_id,
                )
            )

        return errors
