import pytest
from backend.pipeline import strip_trailing_references, reconcile_sources_with_citations

def test_strip_trailing_references_removes_bibliography():
    text = "This is the main answer.\n\n### References\n[1] Author, 2024. Title.\n[2] Another one."
    cleaned = strip_trailing_references(text)
    assert cleaned == "This is the main answer."

def test_strip_trailing_references_removes_works_cited():
    text = "The answer.\n\nWorks Cited\n1. Blah\n2. Blah blah"
    cleaned = strip_trailing_references(text)
    assert cleaned == "The answer."

def test_strip_trailing_references_preserves_topic():
    # If "references" is mentioned as part of the text but not as a heading, it should be kept
    text = "Here we discuss references in the text. They are important.\nAnd here is more text."
    cleaned = strip_trailing_references(text)
    assert cleaned == text

def test_reconcile_sources_with_citations_marks_cited():
    synth_text = "According to [Smith et al., 2023], the climate is changing. [Landscape Alliance, 2024] agrees."
    sources = [
        {"title": "Climate Change", "authors": "Smith, J., Doe, A.", "year": 2023},
        {"title": "Unrelated", "authors": "Johnson, B.", "year": 2022},
        {"title": "Alliance Report", "authors": "Landscape Alliance", "year": 2024}
    ]
    
    updated_sources = reconcile_sources_with_citations(synth_text, sources)
    
    assert updated_sources[0]["cited"] is True
    assert updated_sources[1]["cited"] is False
    assert updated_sources[2]["cited"] is True

def test_reconcile_sources_with_citations_short_title():
    # Fallback to short title matching if authors match fails but citation uses the title
    synth_text = "The [Global Forest Status..., 2023] shows trends."
    sources = [
        {"title": "Global Forest Status Report", "authors": "Unknown Authors", "year": 2023},
    ]
    
    updated_sources = reconcile_sources_with_citations(synth_text, sources)
    
    assert updated_sources[0]["cited"] is True

def test_reconcile_sources_with_citations_defensive_fallback():
    # If no citations found at all, all should be marked cited (fallback behavior)
    synth_text = "The climate is changing, but no citations are present here."
    sources = [
        {"title": "Doc A", "authors": "Smith", "year": 2023},
        {"title": "Doc B", "authors": "Johnson", "year": 2022},
    ]
    
    updated_sources = reconcile_sources_with_citations(synth_text, sources)
    
    assert updated_sources[0]["cited"] is True
    assert updated_sources[1]["cited"] is True
