from app.nlp.context_model import ContextModelModule
from app.nlp.grammar_checker import GrammarCheckerModule
from app.nlp.lightweight_rules import LightweightRuleChecker
from app.nlp.pipeline import NLPPipeline
from app.nlp.spell_checker import SpellCheckerModule


def test_lightweight_rules_detect_common_typo():
    errors = LightweightRuleChecker().check("I am th perosm")
    suggestions = {error.original: error.suggestions[0] for error in errors}
    assert suggestions["th"] == "the"
    assert suggestions["perosm"] == "person"


def test_lightweight_rules_detect_article_agreement_and_lowercase_i():
    errors = LightweightRuleChecker().check("i saw a apple")
    suggestions = {error.original: error.suggestions[0] for error in errors}
    assert suggestions["i"] == "I"
    assert suggestions["a"] == "an"


def test_pipeline_applies_lightweight_rules_without_heavy_models():
    pipeline = NLPPipeline(
        spell_checker=SpellCheckerModule(),
        grammar_checker=GrammarCheckerModule(),
        context_model=ContextModelModule(),
        rule_checker=LightweightRuleChecker(),
        enable_grammar=False,
        enable_context=False,
    )

    result = pipeline.check("i am th perosm")

    assert result.corrected_text == "I am the person"
    assert result.error_counts["grammar"] == 1
    assert result.error_counts["context"] == 2
