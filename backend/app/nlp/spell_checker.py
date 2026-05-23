"""
Spell checker module using pyspellchecker.
Finds misspelled words and returns character-offset-based error suggestions.
"""
import re
from difflib import SequenceMatcher
from spellchecker import SpellChecker as _SpellChecker
from app.models import ErrorSuggestion

# Tokenize while preserving offsets
_TOKEN_RE = re.compile(r"[A-Za-z']+")


class SpellCheckerModule:
    def __init__(self) -> None:
        self._checker = _SpellChecker()

    def add_words(self, words: list[str]) -> None:
        """Add custom words to the dictionary."""
        self._checker.word_frequency.load_words(words)

    def check(self, text: str) -> list[ErrorSuggestion]:
        """Return spelling errors with character offsets."""
        errors: list[ErrorSuggestion] = []

        for match in _TOKEN_RE.finditer(text):
            word = match.group()
            # Skip single characters, numbers, proper-looking nouns starting with uppercase
            if len(word) <= 1:
                continue

            lower_word = word.lower()
            if lower_word not in self._checker:
                # Prefer close textual matches, then keep pyspellchecker's correction as a fallback.
                correction = self._checker.correction(lower_word)
                candidates = sorted(
                    self._checker.candidates(lower_word) or [],
                    key=lambda c: (
                        -SequenceMatcher(None, lower_word, c).ratio(),
                        abs(len(c) - len(lower_word)),
                        -self._checker.word_usage_frequency(c),
                        c,
                    ),
                )
                suggestions = []
                boosted = (
                    correction
                    if correction
                    and len(correction) == len(lower_word)
                    and sorted(correction) == sorted(lower_word)
                    else None
                )
                for candidate in [boosted, *candidates, correction]:
                    if candidate and candidate != lower_word and candidate not in suggestions:
                        suggestions.append(candidate)
                    if len(suggestions) == 5:
                        break

                errors.append(
                    ErrorSuggestion(
                        offset=match.start(),
                        length=len(word),
                        original=word,
                        suggestions=suggestions,
                        error_type="spelling",
                        message=f'"{word}" may be misspelled.',
                        rule_id="SPELL_CHECK",
                    )
                )

        return errors

    def correct(self, text: str) -> str:
        """Return text with spelling errors auto-corrected."""
        errors = self.check(text)
        if not errors:
            return text

        # Apply corrections in reverse offset order to preserve positions
        result = list(text)
        for error in sorted(errors, key=lambda e: e.offset, reverse=True):
            if error.suggestions:
                replacement = error.suggestions[0]
                result[error.offset : error.offset + error.length] = list(replacement)

        return "".join(result)
