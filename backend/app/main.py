"""
FastAPI application entry point.
Handles lifespan (model loading), CORS, rate limiting, and routing.
"""
import logging
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded  # type: ignore
from slowapi import _rate_limit_exceeded_handler  # type: ignore

from app.config import get_settings
from app.middleware.rate_limiter import limiter
from app.nlp.spell_checker import SpellCheckerModule
from app.nlp.grammar_checker import GrammarCheckerModule
from app.nlp.context_model import ContextModelModule
from app.nlp.lightweight_rules import LightweightRuleChecker
from app.nlp.pipeline import NLPPipeline
from app.services.supabase_client import SupabaseService
from app.routers import check as check_router
from app.routers import history as history_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all NLP models and services at startup; clean up at shutdown."""
    settings = get_settings()
    logger.info("=== Autocorrect API starting up ===")

    # Set pipeline to None until fully initialized so /api/check returns 503
    app.state.pipeline = None
    app.state.supabase = None

    # ── Spell Checker (instant) ──────────────────────────────────────────
    spell_checker = SpellCheckerModule()
    logger.info("Spell checker ready.")

    # ── Grammar Checker (starts Java LanguageTool server) ────────────────
    grammar_checker = GrammarCheckerModule()
    if settings.enable_grammar_check:
        grammar_checker.initialize()

    # ── Context Model (downloads/loads ~1.5GB model) ─────────────────────
    context_model = ContextModelModule(
        model_name=settings.hf_model_name,
        device=settings.hf_device,
    )
    if settings.enable_context_model:
        context_model.initialize()

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase = SupabaseService(url=settings.supabase_url, key=settings.supabase_key)

    # Load custom dictionary from Supabase into spell checker
    if supabase.available:
        custom_words = supabase.get_custom_words()
        if custom_words:
            spell_checker.add_words(custom_words)
            logger.info(f"Loaded {len(custom_words)} custom words from Supabase.")

    # ── NLP Pipeline ──────────────────────────────────────────────────────
    pipeline = NLPPipeline(
        spell_checker=spell_checker,
        grammar_checker=grammar_checker,
        context_model=context_model,
        rule_checker=LightweightRuleChecker(),
        enable_grammar=settings.enable_grammar_check,
        enable_context=settings.enable_context_model,
    )

    # Store on app state for dependency injection
    app.state.pipeline = pipeline
    app.state.supabase = supabase

    logger.info("=== Autocorrect API ready ===")
    yield

    # ── Shutdown cleanup ──────────────────────────────────────────────────
    logger.info("Shutting down LanguageTool server…")
    grammar_checker.shutdown()
    logger.info("=== Autocorrect API stopped ===")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Autocorrect Tool API",
        description="AI-powered spelling, grammar, and contextual text correction.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ── Rate Limiter ──────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global error handler ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error", "detail": str(exc), "status_code": 500},
        )

    # ── Request ID + response time logging ───────────────────────────────
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} → {response.status_code} ({elapsed_ms:.1f}ms)"
        )
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{elapsed_ms:.1f}ms"
        return response

    # ── Routers ───────────────────────────────────────────────────────────
    app.include_router(check_router.router, prefix="/api", tags=["correction"])
    app.include_router(history_router.router, prefix="/api", tags=["history"])

    # ── Health check ──────────────────────────────────────────────────────
    @app.get("/api/health", tags=["system"])
    async def health():
        pipeline: NLPPipeline | None = getattr(app.state, "pipeline", None)
        supabase = getattr(app.state, "supabase", None)
        if pipeline is None:
            return JSONResponse(status_code=503, content={"status": "starting", "detail": "NLP pipeline is initializing."})
        return {
            "status": "ok",
            "grammar_checker": pipeline.grammar_checker.available,
            "context_model": pipeline.context_model.available,
            "supabase": supabase.available if supabase else False,
        }

    # ── Stats endpoint ────────────────────────────────────────────────────
    @app.get("/api/stats", tags=["system"])
    async def stats():
        """Return backend capability flags for the frontend to display."""
        pipeline: NLPPipeline | None = getattr(app.state, "pipeline", None)
        supabase = getattr(app.state, "supabase", None)
        if pipeline is None:
            return {"ready": False}
        return {
            "ready": True,
            "spell_checker": True,
            "grammar_checker": pipeline.grammar_checker.available,
            "context_model": pipeline.context_model.available,
            "history_persistence": supabase.available if supabase else False,
            "model": pipeline.context_model.model_name if pipeline.context_model.available else None,
        }

    return app


app = create_app()
