"""Tests for spell checker module."""
import pytest
from app.nlp.spell_checker import SpellCheckerModule


@pytest.fixture
def spell():
    return SpellCheckerModule()


def test_detects_misspellings(spell):
    errors = spell.check("helo wrold")
    assert len(errors) == 2
    words = {e.original.lower() for e in errors}
    assert "helo" in words
    assert "wrold" in words


def test_correct_text_passes(spell):
    errors = spell.check("hello world")
    assert errors == []


def test_suggestions_present(spell):
    errors = spell.check("teh")
    assert len(errors) == 1
    assert "the" in errors[0].suggestions


def test_offsets_correct(spell):
    text = "I hav a dog"
    errors = spell.check(text)
    assert len(errors) == 1
    e = errors[0]
    assert text[e.offset : e.offset + e.length].lower() == "hav"


def test_custom_dictionary(spell):
    spell.add_words(["supabase", "fastapi"])
    errors = spell.check("supabase fastapi")
    assert errors == []


def test_auto_correct(spell):
    corrected = spell.correct("helo wrold")
    assert "hello" in corrected.lower() or "world" in corrected.lower()


def test_error_type_is_spelling(spell):
    errors = spell.check("teh")
    assert all(e.error_type == "spelling" for e in errors)
