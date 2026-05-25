from pydantic import BaseModel, Field, field_validator
from typing import Literal


class CheckRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="Text to check for errors")


class ErrorSuggestion(BaseModel):
    offset: int = Field(..., description="Character offset in the original text")
    length: int = Field(..., description="Length of the erroneous span")
    original: str = Field(..., description="The erroneous text")
    suggestions: list[str] = Field(default_factory=list, description="Ranked replacement options")
    error_type: Literal["spelling", "grammar", "context"] = Field(..., description="Type of error")
    message: str = Field(..., description="Human-readable explanation")
    rule_id: str | None = Field(None, description="LanguageTool rule ID if applicable")


class CheckResponse(BaseModel):
    original_text: str
    errors: list[ErrorSuggestion]
    corrected_text: str
    error_counts: dict[str, int] = Field(default_factory=dict)


class CorrectRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="Text to correct")


class CorrectResponse(BaseModel):
    original_text: str
    corrected_text: str
    changes_made: int


class CorrectionRecord(BaseModel):
    id: str | None = None
    original_text: str
    corrected_text: str
    errors_count: int = 0
    error_types: dict[str, int] = Field(default_factory=dict)
    created_at: str | None = None


class HistoryResponse(BaseModel):
    records: list[CorrectionRecord]
    total: int


class DictionaryRequest(BaseModel):
    words: list[str] = Field(..., min_length=1, description="Words to add to custom dictionary")

    @field_validator("words")
    @classmethod
    def normalize_words(cls, words: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for word in words:
            clean = word.strip().lower()
            if not clean:
                continue
            if not all(char.isalpha() or char in {"'", "-"} for char in clean):
                raise ValueError("Dictionary words may only contain letters, apostrophes, or hyphens")
            if clean not in seen:
                seen.add(clean)
                normalized.append(clean)
        if not normalized:
            raise ValueError("At least one non-empty word is required")
        return normalized


class DictionaryResponse(BaseModel):
    words: list[str]
    total: int


class ErrorResponse(BaseModel):
    error: str
    detail: str
    status_code: int
