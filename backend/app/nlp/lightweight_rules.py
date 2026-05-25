"""
Lightweight grammar/context rules that run without external services.
These cover high-frequency typing issues before optional LanguageTool/model checks.
"""
import re

from app.models import ErrorSuggestion

_WORD_RE = r"[A-Za-z']+"
_REPEATED_WORD_RE = re.compile(rf"\b({_WORD_RE})(\s+)\1\b", re.IGNORECASE)
_LOWERCASE_I_RE = re.compile(r"\bi\b")
_ARTICLE_RE = re.compile(r"\b(a|an)\s+([A-Za-z]+)", re.IGNORECASE)

_COMMON_TYPOS: dict[str, str] = {
    "th": "the",
    "teh": "the",
    "perosm": "person",
    "persom": "person",
    "recieve": "receive",
    "seperate": "separate",
    "definately": "definitely",
    "occured": "occurred",
    "untill": "until",
    "becuase": "because",
}


def _starts_with_vowel_sound(word: str) -> bool:
    return bool(word) and word[0].lower() in {"a", "e", "i", "o", "u"}


class LightweightRuleChecker:
    """Small deterministic rules for common real-world typing errors."""

    @property
    def available(self) -> bool:
        return True

    def check(self, text: str) -> list[ErrorSuggestion]:
        errors: list[ErrorSuggestion] = []
        claimed_ranges: list[tuple[int, int]] = []

        for match in _REPEATED_WORD_RE.finditer(text):
            replacement = match.group(1)
            errors.append(
                ErrorSuggestion(
                    offset=match.start(),
                    length=match.end() - match.start(),
                    original=match.group(0),
                    suggestions=[replacement],
                    error_type="grammar",
                    message=f'Repeated word. Consider "{replacement}".',
                    rule_id="REPEATED_WORD",
                )
            )
            claimed_ranges.append((match.start(), match.end()))

        for match in _ARTICLE_RE.finditer(text):
            article, next_word = match.group(1), match.group(2)
            expected = "an" if _starts_with_vowel_sound(next_word) else "a"
            if article.lower() == expected:
                continue
            replacement = expected if article.islower() else expected.capitalize()
            errors.append(
                ErrorSuggestion(
                    offset=match.start(1),
                    length=len(article),
                    original=article,
                    suggestions=[replacement],
                    error_type="grammar",
                    message=f'Use "{replacement}" before "{next_word}".',
                    rule_id="ARTICLE_AGREEMENT",
                )
            )

        for match in _LOWERCASE_I_RE.finditer(text):
            if any(start <= match.start() < end for start, end in claimed_ranges):
                continue
            errors.append(
                ErrorSuggestion(
                    offset=match.start(),
                    length=1,
                    original="i",
                    suggestions=["I"],
                    error_type="grammar",
                    message='The pronoun "I" should be capitalized.',
                    rule_id="CAPITALIZE_I",
                )
            )

        for match in re.finditer(rf"\b({_WORD_RE})\b", text):
            word = match.group(1)
            replacement = _COMMON_TYPOS.get(word.lower())
            if not replacement:
                continue
            if word[0].isupper():
                replacement = replacement.capitalize()
            errors.append(
                ErrorSuggestion(
                    offset=match.start(),
                    length=len(word),
                    original=word,
                    suggestions=[replacement],
                    error_type="context",
                    message=f'Common typing error. Consider "{replacement}".',
                    rule_id="COMMON_TYPO",
                )
            )

        return sorted(errors, key=lambda error: error.offset)
