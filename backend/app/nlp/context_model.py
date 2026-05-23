"""
Context correction model using grammarly/coedit-large.
Uses encoder-decoder T5 architecture for deep contextual grammar correction.
"""
import difflib
import logging
from app.models import ErrorSuggestion

logger = logging.getLogger(__name__)

# Instruction prefix required by CoEdIT models
_INSTRUCTION_PREFIX = "Fix grammatical errors in this sentence: "


class ContextModelModule:
    def __init__(self, model_name: str = "grammarly/coedit-large", device: str = "cpu") -> None:
        self._model_name = model_name
        self._device = device
        self._tokenizer = None
        self._model = None

    def initialize(self) -> None:
        """Load model and tokenizer. Call once at startup."""
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM  # type: ignore
            import torch  # type: ignore

            logger.info(f"Loading context model: {self._model_name}…")
            self._tokenizer = AutoTokenizer.from_pretrained(self._model_name)
            self._model = AutoModelForSeq2SeqLM.from_pretrained(self._model_name)
            self._model.eval()
            logger.info("Context model loaded.")
        except Exception as exc:
            logger.warning(f"Context model unavailable: {exc}. Contextual correction disabled.")
            self._tokenizer = None
            self._model = None

    @property
    def available(self) -> bool:
        return self._model is not None and self._tokenizer is not None

    def correct(self, text: str) -> str:
        """Return contextually corrected text."""
        if not self.available:
            return text

        try:
            import torch  # type: ignore

            input_text = _INSTRUCTION_PREFIX + text
            inputs = self._tokenizer(
                input_text,
                return_tensors="pt",
                max_length=512,
                truncation=True,
            )

            with torch.no_grad():
                outputs = self._model.generate(
                    inputs["input_ids"],
                    max_length=512,
                    num_beams=4,
                    early_stopping=True,
                )

            corrected = self._tokenizer.decode(outputs[0], skip_special_tokens=True)
            return corrected
        except Exception as exc:
            logger.error(f"Context model inference failed: {exc}")
            return text

    def get_suggestions(self, text: str) -> list[ErrorSuggestion]:
        """Diff original vs corrected to extract character-level error spans."""
        if not self.available:
            return []

        corrected = self.correct(text)
        if corrected == text:
            return []

        errors: list[ErrorSuggestion] = []
        matcher = difflib.SequenceMatcher(None, text, corrected, autojunk=False)

        for op, i1, i2, j1, j2 in matcher.get_opcodes():
            if op == "equal":
                continue

            original_span = text[i1:i2]
            replacement = corrected[j1:j2]

            if not original_span and not replacement:
                continue

            errors.append(
                ErrorSuggestion(
                    offset=i1,
                    length=max(i2 - i1, 1),
                    original=original_span,
                    suggestions=[replacement] if replacement else [],
                    error_type="context",
                    message=f'Consider: "{replacement}"' if replacement else "Consider removing this.",
                    rule_id="CONTEXT_MODEL",
                )
            )

        return errors
