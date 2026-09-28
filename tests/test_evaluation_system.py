import unittest
from unittest.mock import MagicMock, patch
import uuid
import os
import json
from pathlib import Path

from backend.evaluation_engine import (
    score_citation_quality,
    score_canary_response,
    load_csv_dataset,
    EvaluationEngine,
    EVAL_CONFIG,
)


class TestEvaluationMetrics(unittest.TestCase):
    """Test custom metrics: citation quality and canary scoring."""

    def test_score_citation_quality_perfect(self):
        answer = (
            "According to recent agroforestry studies, tree canopy diversity improves soil organic carbon "
            "[Hoang et al., 2010]. Further evidence indicates that prescribed burns enhance nutrient cycling [Smith, 2021]."
        )
        sources = [
            {"title": "Agroforestry Impact", "authors": ["Hoang, T.", "Nguyen, L."], "year": 2010},
            {"title": "Fire Regimes", "authors": ["Smith, J."], "year": 2021},
        ]
        score = score_citation_quality(answer, sources)
        self.assertGreaterEqual(score, 0.8)

    def test_score_citation_quality_bad_citations(self):
        # Document numbers are strictly forbidden in acAIcia
        answer = "Food systems contribute significantly to greenhouse gases [1], as shown in [Document 2]."
        sources = [{"title": "Food Systems", "authors": ["Brown, A."], "year": 2020}]
        score = score_citation_quality(answer, sources)
        self.assertLess(score, 0.4)

    def test_score_citation_quality_empty(self):
        score = score_citation_quality("", [])
        self.assertEqual(score, 0.0)
        score_whitespace = score_citation_quality("   ", [])
        self.assertEqual(score_whitespace, 0.0)

    def test_score_canary_response_abstain(self):
        # When model admits no information
        correct = score_canary_response(
            "I don't have access to information about ancient Roman fire policies in the CIFOR-ICRAF database.",
            expected_behavior="abstain"
        )
        self.assertTrue(correct)

    def test_score_canary_response_hallucination(self):
        # When model hallucinates a long confident answer on ungrounded topic
        hallucinated = (
            "Ancient Roman fire policies were established during the reign of Augustus, who created the "
            "Vigiles Urbani to patrol the streets of Rome and enforce strict building regulations, "
            "mandating spacing between multi-story insulae to prevent massive urban conflagrations."
        )
        handled = score_canary_response(hallucinated, expected_behavior="abstain")
        self.assertFalse(handled)

    def test_score_canary_response_short(self):
        # Short or empty answer is treated as abstention
        self.assertTrue(score_canary_response("", expected_behavior="abstain"))
        self.assertTrue(score_canary_response("No data.", expected_behavior="abstain"))


class TestEvaluationEngine(unittest.TestCase):
    """Test engine dataset loading, summary calculation, and fallbacks."""

    def setUp(self):
        self.mock_supabase = MagicMock()
        self.engine = EvaluationEngine(
            supabase_client=self.mock_supabase,
            backend_url="https://mock.acaicia.org",
        )

    def test_load_dataset_with_existing_csv(self):
        # test_questions.csv exists in the repo root
        questions = self.engine.load_dataset("test_questions.csv", limit=3, include_canaries=False)
        self.assertGreater(len(questions), 0)
        self.assertLessEqual(len(questions), 3)
        self.assertIn("input_query", questions[0])

    def test_load_dataset_missing_csv_uses_builtin_fallback(self):
        # Non-existent file should fall back to built-in questions
        questions = self.engine.load_dataset("non_existent_file.csv", limit=2, include_canaries=False)
        self.assertGreater(len(questions), 0)
        self.assertEqual(questions[0]["source_dataset"], "builtin_benchmark")

    def test_compute_summary(self):
        details = [
            {
                "question_index": 1,
                "question_type": "standard",
                "faithfulness": 0.9,
                "answer_relevancy": 0.85,
                "context_precision": 0.8,
                "context_recall": 0.75,
                "citation_quality": 0.95,
                "hit_at_5": True,
                "hit_at_1": True,
                "latency_ms": 1200,
            },
            {
                "question_index": 2,
                "question_type": "standard",
                "faithfulness": 0.8,
                "answer_relevancy": 0.8,
                "context_precision": 0.7,
                "context_recall": 0.7,
                "citation_quality": 0.85,
                "hit_at_5": True,
                "hit_at_1": False,
                "latency_ms": 1400,
            },
            {
                "question_index": 3,
                "question_type": "canary",
                "faithfulness": 1.0,
                "answer_relevancy": 1.0,
                "notes": "canary_handled=correct",
                "latency_ms": 600,
            }
        ]
        summary = self.engine._compute_summary(details)
        self.assertAlmostEqual(summary["avg_faithfulness"], 0.9, places=2)
        self.assertAlmostEqual(summary["avg_answer_relevancy"], 0.8833, places=2)
        self.assertEqual(summary["hit_rate_at_5"], 100.0)
        self.assertEqual(summary["hit_rate_at_1"], 50.0)
        self.assertEqual(summary["canary_violations"], 0)
        self.assertEqual(summary["canary_total"], 1)

    def test_compute_summary_with_canary_violation(self):
        details = [
            {
                "question_index": 1,
                "question_type": "canary",
                "faithfulness": 0.0,
                "answer_relevancy": 0.0,
                "notes": "canary_handled=VIOLATION",
                "latency_ms": 800,
            }
        ]
        summary = self.engine._compute_summary(details)
    def test_score_citation_quality_ampersand(self):
        # Academic citations frequently use ampersand: [Author & Coauthor, Year]
        answer = "Recent assessments show peat degradation accelerates fire risk [Hoang & Smith, 2020]."
        sources = [{"title": "Peat Assessment", "authors": ["Hoang, T.", "Smith, J."], "year": 2020}]
        score = score_citation_quality(answer, sources)
        self.assertGreaterEqual(score, 0.8)

    def test_score_citation_quality_organizational_author(self):
        answer = "Strategic guidelines for peat restoration prioritize community engagement [CIFOR-ICRAF, 2024]."
        sources = [{"title": "Peat Restoration Guidelines", "authors": ["CIFOR-ICRAF Research Team"], "year": 2024}]
        score = score_citation_quality(answer, sources)
        self.assertGreaterEqual(score, 0.8)

    def test_score_citation_quality_middle_author(self):
        # Authors provided as comma-separated string in source metadata
        answer = "Hydrological restoration reduces fire vulnerability [Nam et al., 2020]."
        sources = [{"title": "Peat Hydrology", "authors": "Hoang, M.H., Nam, V.T., Smith, J.", "year": 2020}]
        score = score_citation_quality(answer, sources)
        self.assertGreaterEqual(score, 0.8)

    def test_score_citation_quality_source_brackets(self):
        # Bracketed indices like [Source 1] or [Doc 2] are strictly penalized
        answer = "According to [Source 1], soil carbon decreases with deforestation [Doc 2]."
        sources = [{"title": "Soil Carbon", "authors": ["Brown, A."], "year": 2020}]
        score = score_citation_quality(answer, sources)
        self.assertLess(score, 0.4)

    def test_update_run_status_fallback(self):
        # When extended columns fail on older schema, it should gracefully fall back to base columns
        mock_table = MagicMock()
        mock_table.update.side_effect = [
            Exception("Column run_type does not exist"),  # First call (extended) fails
            MagicMock(execute=MagicMock(return_value=MagicMock()))  # Second call (base) succeeds
        ]
        self.mock_supabase.table.return_value = mock_table

        summary = {
            "passed": True,
            "avg_faithfulness": 0.85,
            "hit_rate_at_5": 90.0,
            "avg_context_precision": 0.8,
            "avg_latency_ms": 500.0,
        }
        self.engine._update_run_status("run-123", "completed", 10, 0.0, summary)
        self.assertEqual(mock_table.update.call_count, 2)


if __name__ == "__main__":
    unittest.main()

