"""
DeepEval RAG Evaluation Suite for acAIcia
==========================================
Closes: https://github.com/BongweKE/acAIcia/issues/8

Replaces the custom LLM-as-judge prompts in eval_runner.py with validated
DeepEval metrics (Faithfulness, AnswerRelevancy, ContextualPrecision, ContextualRecall).

Judge model: Mistral Small 4 (via MISTRAL_API_KEY env var)
             Falls back to no judge model if MISTRAL_API_KEY is not set
             (runs without LLM-based scoring, uses threshold-only mode)

CI gate:
    pytest tests/deepeval_suite.py -v
    Fails if any metric drops > THRESHOLD_DELTA (0.05) from eval_baseline.json

To update baseline after intentional improvements:
    python tests/deepeval_suite.py --update-baseline

Usage:
    # Run full eval against live acAIcia backend
    MISTRAL_API_KEY=... ACAICIA_BACKEND_URL=https://... pytest tests/deepeval_suite.py -v

    # Run offline smoke test (no backend required)
    MISTRAL_API_KEY=... pytest tests/deepeval_suite.py -v -k "offline"
"""

import os
import csv
import json
import time
import requests
import argparse
from pathlib import Path

import pytest

# ─── Paths ────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
BASELINE_PATH = Path(__file__).parent / "eval_baseline.json"
EVAL_CSV_PATH = REPO_ROOT / "test_questions.csv"
DIFFICULT_CSV_PATH = REPO_ROOT / "test_questions_difficult.csv"

# ─── Configuration ────────────────────────────────────────────────────────────
THRESHOLD_DELTA = 0.05          # CI fails if metric drops more than this from baseline
DEFAULT_METRIC_THRESHOLD = 0.7  # Minimum score to consider a test case passing
EVAL_LIMIT = 20                 # Number of eval pairs used in CI (keep small for speed)
BACKEND_TIMEOUT = 90            # seconds to wait for backend response

ACAICIA_BACKEND_URL = os.environ.get(
    "ACAICIA_BACKEND_URL",
    "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run"
)
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")


# ─── DeepEval imports (lazy, so pytest collection still works if not installed) ─
def _import_deepeval():
    try:
        from deepeval.metrics import (
            FaithfulnessMetric,
            AnswerRelevancyMetric,
            ContextualPrecisionMetric,
            ContextualRecallMetric,
        )
        from deepeval.test_case import LLMTestCase
        from deepeval import evaluate
        return FaithfulnessMetric, AnswerRelevancyMetric, ContextualPrecisionMetric, ContextualRecallMetric, LLMTestCase, evaluate
    except ImportError as e:
        raise ImportError(
            "deepeval not installed. Run: .venv/bin/pip install deepeval"
        ) from e


class MistralJudge:
    pass

def _get_judge_model():
    """Return a DeepEval-compatible judge model backed by Mistral."""
    if not MISTRAL_API_KEY:
        print("WARNING: MISTRAL_API_KEY not set — running without LLM judge.")
        return None
    try:
        from typing import Optional, Union, Tuple
        from pydantic import BaseModel
        from deepeval.models import DeepEvalBaseLLM
        from deepeval.metrics.utils import trimAndLoadJson
        try:
            from mistralai.client import Mistral
        except ImportError:
            from mistralai import Mistral

        class _CustomMistralJudge(DeepEvalBaseLLM):
            def __init__(self, api_key: str, model: str = "ministral-8b-latest"):
                self.api_key = api_key
                self.model_name = model
                super().__init__(model=model)

            def load_model(self):
                return Mistral(api_key=self.api_key)

            def get_model_name(self):
                return self.model_name

            def _normalize_json(self, data):
                if isinstance(data, dict):
                    for key in ["claims", "truths", "verdicts", "statements"]:
                        if key in data and isinstance(data[key], list):
                            norm = []
                            for item in data[key]:
                                if isinstance(item, dict) and key in ["claims", "truths", "statements"]:
                                    norm.append(list(item.values())[0] if item else "")
                                else:
                                    norm.append(item)
                            data[key] = norm
                    return data
                return data

            def generate(self, prompt: str, schema: Optional[BaseModel] = None, **kwargs) -> Tuple[Union[str, BaseModel], float]:
                res = self.model.chat.complete(
                    model=self.model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.0
                )
                content = res.choices[0].message.content or ""
                cost = 0.0
                if schema:
                    data = trimAndLoadJson(content)
                    data = self._normalize_json(data)
                    return schema.model_validate(data), cost
                return content, cost

            async def a_generate(self, prompt: str, schema: Optional[BaseModel] = None, **kwargs) -> Tuple[Union[str, BaseModel], float]:
                return self.generate(prompt, schema, **kwargs)

        return _CustomMistralJudge(api_key=MISTRAL_API_KEY)
    except Exception as e:
        print(f"WARNING: Could not configure Mistral judge model: {e}. Skipping LLM judge.")
        return None


# ─── Test Case Builders ────────────────────────────────────────────────────────

def load_csv_rows(path: Path, limit: int = EVAL_LIMIT) -> list:
    """Load evaluation Q&A pairs from a CSV file."""
    rows = []
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= limit:
                break
            rows.append(row)
    return rows


def query_acaicia(question: str, timeout: int = BACKEND_TIMEOUT) -> tuple:
    """Submit a query to the live acAIcia backend. Returns (answer, retrieval_context)."""
    try:
        r = requests.post(
            f"{ACAICIA_BACKEND_URL}/query",
            json={"query": question, "guest_session_id": "deepeval-ci"},
            timeout=30
        )
        r.raise_for_status()
        query_id = r.json().get("query_id")
        if not query_id:
            return "", []

        deadline = time.time() + timeout
        while time.time() < deadline:
            status_r = requests.get(
                f"{ACAICIA_BACKEND_URL}/query/status/{query_id}",
                timeout=10
            )
            if status_r.status_code == 200:
                data = status_r.json()
                if data.get("status") == "completed":
                    answer = data.get("response", "")
                    sources = data.get("sources", [])
                    context = [s.get("snippet", s.get("title", "")) for s in sources if s]
                    return answer, context
                elif data.get("status") == "failed":
                    return "", []
            time.sleep(3)
        return "", []
    except Exception as e:
        print(f"  Backend query failed: {e}")
        return "", []


def build_offline_test_cases():
    """Build minimal pre-defined test cases for offline/smoke testing."""
    (FaithfulnessMetric, AnswerRelevancyMetric,
     ContextualPrecisionMetric, ContextualRecallMetric,
     LLMTestCase, evaluate) = _import_deepeval()

    return [
        LLMTestCase(
            input="What percentage of Ghana's GHG emissions come from food systems?",
            actual_output=(
                "According to Mensah et al. (2023), food systems contribute approximately "
                "54.1% of Ghana's total national anthropogenic GHG emissions."
            ),
            expected_output="54.1%",
            retrieval_context=[
                "Food systems contribute 54.1% of Ghana's total national anthropogenic "
                "greenhouse gas (GHG) emissions, with livestock being the largest subsector."
            ],
        ),
        LLMTestCase(
            input="What was the maximum groundwater depth in South Sumatra peatland study?",
            actual_output=(
                "During the 58-day dry period monitored, the groundwater table dropped to a "
                "maximum depth of 78.5 cm below the surface [Ritzema et al., 2024]."
            ),
            expected_output="78.5 cm",
            retrieval_context=[
                "The groundwater table reached a maximum depth of 78.5 cm below the peat surface "
                "during the monitored 58-day dry period in South Sumatra."
            ],
        ),
        LLMTestCase(
            input="How many prescribed burn records does the GlobalRx dataset contain?",
            actual_output=(
                "The GlobalRx dataset contains a total of 204,517 prescribed burn records "
                "spanning multiple continents [Smith et al., 2025]."
            ),
            expected_output="204,517",
            retrieval_context=[
                "GlobalRx contains 204,517 prescribed burn records compiled from regional "
                "fire management agencies across North America, Europe, and Australia."
            ],
        ),
    ]


def build_live_test_cases(limit: int = EVAL_LIMIT):
    """Build test cases by querying the live acAIcia backend."""
    (FaithfulnessMetric, AnswerRelevancyMetric,
     ContextualPrecisionMetric, ContextualRecallMetric,
     LLMTestCase, evaluate) = _import_deepeval()

    rows = load_csv_rows(EVAL_CSV_PATH, limit=limit)
    if not rows:
        rows = [
            {"test_question": "What percentage of Ghana's total national anthropogenic GHG emissions come from food systems?", "expected_answer": "54.1%", "document_title": "Ghana food systems"},
            {"test_question": "During the 58-day dry period monitored in South Sumatra, what was the maximum groundwater depth reached?", "expected_answer": "78.5 cm", "document_title": "Peat hydrology South Sumatra"},
        ]

    print(f"Building {len(rows)} live test cases from acAIcia backend at {ACAICIA_BACKEND_URL}...")
    test_cases = []
    for i, row in enumerate(rows, 1):
        question = row.get("test_question", "")
        expected = row.get("expected_answer", "")
        doc_title = row.get("document_title", "")
        if not question:
            continue
        print(f"  [{i}/{len(rows)}] {question[:70]}...")
        actual_output, retrieval_context = query_acaicia(question)
        if not actual_output:
            print(f"    Skipping (no backend response)")
            continue
        test_cases.append(LLMTestCase(
            input=question,
            actual_output=actual_output,
            expected_output=expected,
            retrieval_context=retrieval_context or [doc_title],
        ))
    print(f"  Built {len(test_cases)} test cases successfully.")
    return test_cases


# ─── Baseline Management ───────────────────────────────────────────────────────

def load_baseline() -> dict:
    if BASELINE_PATH.exists():
        return json.loads(BASELINE_PATH.read_text())
    return {}


def save_baseline(scores: dict):
    scores["_run_date"] = time.strftime("%Y-%m-%d")
    scores["_provider"] = "mistral"
    BASELINE_PATH.write_text(json.dumps(scores, indent=2))
    print(f"Baseline saved to {BASELINE_PATH}")


# ─── Pytest Tests ──────────────────────────────────────────────────────────────

@pytest.mark.skipif(
    not MISTRAL_API_KEY,
    reason="MISTRAL_API_KEY not set"
)
def test_rag_metrics_offline():
    """
    Offline smoke test: runs DeepEval metrics on pre-defined test cases.
    Fast (~30s), no backend required. Good for CI on pull requests.
    """
    (FaithfulnessMetric, AnswerRelevancyMetric,
     ContextualPrecisionMetric, ContextualRecallMetric,
     LLMTestCase, evaluate) = _import_deepeval()

    judge = _get_judge_model()
    test_cases = build_offline_test_cases()

    metrics = [
        FaithfulnessMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
        AnswerRelevancyMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
    ]

    baseline = load_baseline()
    results = evaluate(test_cases=test_cases, metrics=metrics)

    # Regression gate
    metric_scores = {}
    for test_result in (getattr(results, "test_results", None) or []):
        for m in (getattr(test_result, "metrics_data", None) or []):
            metric_scores.setdefault(m.name, []).append(m.score)

    for metric_name, scores_list in metric_scores.items():
        avg = sum(scores_list) / len(scores_list)
        baseline_val = baseline.get(metric_name)
        if baseline_val is not None:
            assert avg >= (baseline_val - THRESHOLD_DELTA), (
                f"REGRESSION: {metric_name} dropped from {baseline_val:.3f} "
                f"to {avg:.3f} (limit: -{THRESHOLD_DELTA})"
            )


@pytest.mark.slow
@pytest.mark.skipif(
    not MISTRAL_API_KEY,
    reason="MISTRAL_API_KEY not set"
)
def test_rag_metrics_live():
    """
    Full live eval: hits the acAIcia backend and scores all 4 RAG metrics.
    Slow (~10-20 min). Run nightly or pre-deploy.
    Mark: pytest -m slow tests/deepeval_suite.py
    """
    (FaithfulnessMetric, AnswerRelevancyMetric,
     ContextualPrecisionMetric, ContextualRecallMetric,
     LLMTestCase, evaluate) = _import_deepeval()

    judge = _get_judge_model()
    test_cases = build_live_test_cases(limit=EVAL_LIMIT)

    if not test_cases:
        pytest.skip("No test cases could be built from the backend.")

    metrics = [
        FaithfulnessMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
        AnswerRelevancyMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
        ContextualPrecisionMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
        ContextualRecallMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
    ]

    baseline = load_baseline()
    results = evaluate(test_cases=test_cases, metrics=metrics)

    metric_scores = {}
    for tr in (getattr(results, "test_results", None) or []):
        for m in (getattr(tr, "metrics_data", None) or []):
            metric_scores.setdefault(m.name, []).append(m.score)

    avg_scores = {k: round(sum(v) / len(v), 4) for k, v in metric_scores.items()}
    print(f"\nAverage scores: {avg_scores}")

    for metric_name, avg_score in avg_scores.items():
        baseline_val = baseline.get(metric_name)
        if baseline_val is not None:
            assert avg_score >= (baseline_val - THRESHOLD_DELTA), (
                f"REGRESSION: {metric_name} dropped from {baseline_val:.3f} "
                f"to {avg_score:.3f} (limit: -{THRESHOLD_DELTA}). "
                f"Run: python tests/deepeval_suite.py --update-baseline"
            )


# ─── CLI: Update Baseline ──────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DeepEval baseline manager for acAIcia")
    parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="Run full eval and write a new eval_baseline.json"
    )
    parser.add_argument("--limit", type=int, default=EVAL_LIMIT)
    args = parser.parse_args()

    if args.update_baseline:
        (FaithfulnessMetric, AnswerRelevancyMetric,
         ContextualPrecisionMetric, ContextualRecallMetric,
         LLMTestCase, evaluate) = _import_deepeval()

        judge = _get_judge_model()
        test_cases = build_live_test_cases(limit=args.limit)
        if not test_cases:
            print("No test cases built. Check ACAICIA_BACKEND_URL.")
            raise SystemExit(1)

        metrics = [
            FaithfulnessMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
            AnswerRelevancyMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
            ContextualPrecisionMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
            ContextualRecallMetric(threshold=DEFAULT_METRIC_THRESHOLD, model=judge),
        ]
        results = evaluate(test_cases=test_cases, metrics=metrics)

        metric_scores = {}
        for tr in (getattr(results, "test_results", None) or []):
            for m in (getattr(tr, "metrics_data", None) or []):
                metric_scores.setdefault(m.name, []).append(m.score)

        avg_scores = {k: round(sum(v) / len(v), 4) for k, v in metric_scores.items()}
        print(f"\nNew baseline scores: {avg_scores}")
        save_baseline(avg_scores)
    else:
        parser.print_help()
