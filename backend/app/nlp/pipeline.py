"""
NLP Pipeline orchestrator — tiered correction strategy.

Tier 1 (Fast):   pyspellchecker  — instant spell check
Tier 2 (Medium): language-tool   — grammar + style
Tier 3 (Deep):   CoEdIT model    — contextual AI correction

Tiers 1 & 2 run concurrently; Tier 3 runs after.
Results are merged and deduplicated by character offset.
"""
import logging
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from collections import Counter
from typing import Callable

from app.models import CheckResponse, CorrectResponse, ErrorSuggestion
from app.nlp.spell_checker import SpellCheckerModule
from app.nlp.grammar_checker import GrammarCheckerModule
from app.nlp.context_model import ContextModelModule
from app.nlp.lightweight_rules import LightweightRuleChecker

logger = logging.getLogger(__name__)

# Priority: higher value wins when merging overlapping errors
_SOURCE_PRIORITY = {"context": 3, "grammar": 2, "spelling": 1}


def _ranges_overlap(a_offset: int, a_len: int, b_offset: int, b_len: int) -> bool:
    """Return True if two character ranges overlap."""
    return a_offset < b_offset + b_len and b_offset < a_offset + a_len


def _merge_errors(errors: list[ErrorSuggestion]) -> list[ErrorSuggestion]:
    """
    Deduplicate overlapping errors.
    When two errors overlap, keep the one with higher source priority.
    """
    if not errors:
        return []

    # Sort by descending priority, then by offset
    sorted_errors = sorted(
        errors,
        key=lambda e: (-_SOURCE_PRIORITY.get(e.error_type, 0), e.offset),
    )

    merged: list[ErrorSuggestion] = []
    for error in sorted_errors:
        # Check if this error overlaps with any already-accepted error
        overlaps = False
        for accepted in merged:
            if _ranges_overlap(accepted.offset, accepted.length, error.offset, error.length):
                # Keep the higher-priority one (already in `merged` since sorted by priority desc)
                overlaps = True
                break
        if not overlaps:
            merged.append(error)

    return sorted(merged, key=lambda e: e.offset)


class NLPPipeline:
    def __init__(
        self,
        spell_checker: SpellCheckerModule,
        grammar_checker: GrammarCheckerModule,
        context_model: ContextModelModule,
        rule_checker: LightweightRuleChecker | None = None,
        enable_grammar: bool = True,
        enable_context: bool = True,
    ) -> None:
        self.spell_checker = spell_checker
        self.grammar_checker = grammar_checker
        self.context_model = context_model
        self.rule_checker = rule_checker or LightweightRuleChecker()
        self.enable_grammar = enable_grammar
        self.enable_context = enable_context

    def check(self, text: str) -> CheckResponse:
        """
        Run the full NLP pipeline synchronously (use regular def — CPU-bound).
        Returns all errors with character offsets and a fully corrected text.
        """
        all_errors: list[ErrorSuggestion] = []

        # ── Tier 1 & 2: Run concurrently ─────────────────────────────────
        tasks: dict[str, Callable[[], list[ErrorSuggestion]]] = {
            "spelling": lambda: self.spell_checker.check(text),
            "rules": lambda: self.rule_checker.check(text),
        }

        if self.enable_grammar and self.grammar_checker.available:
            tasks["grammar"] = lambda: self.grammar_checker.check(text)

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures: dict[Future[list[ErrorSuggestion]], str] = {executor.submit(fn): name for name, fn in tasks.items()}
            for future in as_completed(futures):
                name = futures[future]
                try:
                    result = future.result()
                    all_errors.extend(result)
                except Exception as exc:
                    logger.error(f"{name} check failed: {exc}")

        # ── Tier 3: Deep contextual model ────────────────────────────────
        if self.enable_context and self.context_model.available:
            try:
                context_errors = self.context_model.get_suggestions(text)
                all_errors.extend(context_errors)
            except Exception as exc:
                logger.error(f"Context model check failed: {exc}")

        # ── Merge & deduplicate ───────────────────────────────────────────
        merged = _merge_errors(all_errors)

        # ── Build corrected text ──────────────────────────────────────────
        corrected = _apply_corrections(text, merged)

        # ── Count by type ─────────────────────────────────────────────────
        error_counts: dict[str, int] = {key: value for key, value in Counter(e.error_type for e in merged).items()}

        return CheckResponse(
            original_text=text,
            errors=merged,
            corrected_text=corrected,
            error_counts=error_counts,
        )

    def correct(self, text: str) -> CorrectResponse:
        """Return only the corrected text with a change count."""
        response = self.check(text)
        changes = sum(1 for e in response.errors if e.suggestions)
        return CorrectResponse(
            original_text=text,
            corrected_text=response.corrected_text,
            changes_made=changes,
        )


def _apply_corrections(text: str, errors: list[ErrorSuggestion]) -> str:
    """Apply the top suggestion for each error in reverse offset order."""
    result = list(text)
    for error in sorted(errors, key=lambda e: e.offset, reverse=True):
        if error.suggestions:
            replacement = list(error.suggestions[0])
            result[error.offset : error.offset + error.length] = replacement
    return "".join(result)
