from pydantic import Field
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Autocorrect Tool API"
    debug: bool = Field(default=False, validation_alias="APP_DEBUG")

    # CORS — comma-separated origins
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

    # Hugging Face model
    hf_model_name: str = "grammarly/coedit-large"
    hf_device: str = "cpu"  # "cuda" if GPU available

    # Rate limiting
    rate_limit_check: str = "30/minute"
    rate_limit_correct: str = "10/minute"

    # Supabase (optional)
    supabase_url: str = ""
    supabase_key: str = ""

    # NLP pipeline flags
    enable_grammar_check: bool = True
    enable_context_model: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
