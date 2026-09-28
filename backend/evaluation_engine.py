"""
acAIcia Comprehensive RAG Evaluation Engine
============================================
Runs multi-dimensional evaluation against the live acAIcia backend pipeline.
Supports: DeepEval metrics, custom citation quality, canary detection,
retrieval Hit@k, and per-question detail persistence.

Usage:
    # As a module (imported by backend/app.py eval workers):
    from backend.evaluation_engine import EvaluationEngine
    engine = EvaluationEngine(supabase_client, backend_url)
    result = engine.run_evaluation(dataset_name="test_questions.csv", limit=20)

    # As a standalone CLI:
    python -m backend.evaluation_engine --dataset test_questions.csv --limit 10
"""

import os
import re
import csv
import json
import time
import uuid
import logging
import requests
from pathlib import Path
from typing import Optional

logger = logging.getLogger("acaicia-eval-engine")

# ─── Repository paths ────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
DATASETS_DIR = REPO_ROOT
BASELINE_PATH = REPO_ROOT / "tests" / "eval_baseline.json"

# ─── Evaluation configuration ────────────────────────────────────────────────
EVAL_CONFIG = {
    "thresholds": {
        "faithfulness": 0.70,
        "answer_relevancy": 0.70,
        "context_precision": 0.65,
        "context_recall": 0.60,
        "citation_quality": 0.75,
        "hit_rate_at_5": 75.0,
    },
    "canary_max_violations": 1,
    "default_judge": "ministral-8b-latest",
    "backend_timeout_sec": 120,
    "poll_interval_sec": 2,
}

# ─── Dataset loader functions ────────────────────────────────────────────────

def load_csv_dataset(csv_path: Path, limit: int = None) -> list:
    """Load Q&A pairs from a CSV test dataset file."""
    rows = []
    if not csv_path.exists():
        logger.warning(f"Dataset file not found: {csv_path}")
        return rows
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break
            question = row.get("test_question", "").strip()
            if not question:
                continue
            rows.append({
                "input_query": question,
                "expected_output": row.get("expected_answer", ""),
                "target_title": row.get("document_title", ""),
                "target_doi": row.get("doi", ""),
                "question_type": "standard",
                "source_dataset": csv_path.name,
            })
    return rows


def load_canary_questions(supabase_client) -> list:
    """Load active canary questions from Supabase."""
    try:
        res = supabase_client.table("canary_questions") \
            .select("*").eq("is_active", True).execute()
        return [{
            "input_query": q["question_text"],
            "expected_output": None,
            "target_title": "",
            "target_doi": "",
            "question_type": "canary",
            "expected_behavior": q.get("expected_behavior", "abstain"),
            "topic_category": q.get("topic_category"),
            "source_dataset": "canary_questions",
        } for q in (res.data or [])]
    except Exception as e:
        logger.warning(f"Failed to load canary questions: {e}")
        return []


# ─── Custom Metrics ──────────────────────────────────────────────────────────

def score_citation_quality(answer: str, sources: list) -> float:
    """
    Scores how well the answer follows acAIcia's citation protocol.

    Rules checked:
    1. Inline citations use [Author(s), Year] format
    2. No document number references ([1], [Document 1], etc.)
    3. Cited authors match retrieved source authors
    4. Cited years match retrieved source publication years
    5. Every substantial claim paragraph has at least one citation
    """
    if not answer or not answer.strip():
        return 0.0

    score_components = []

    # 1. Check for proper citation format
    proper_citations = re.findall(
        r'\[([A-Za-zà-ü\-\s]+?(?:\s+et\s+al\.|\s+(?:and|&)\s+[A-Za-zà-ü\-]+)?),?\s*(\d{4})\]',
        answer
    )
    bad_citations = re.findall(r'\[(?:Document\s+|Doc\s+|Source\s+)?\d+(?:[,\s\d]+)?\]', answer, re.IGNORECASE)

    if proper_citations and not bad_citations:
        score_components.append(1.0)
    elif proper_citations and bad_citations:
        score_components.append(0.5)
    elif not proper_citations and not bad_citations:
        score_components.append(0.3)  # No citations at all
    else:
        score_components.append(0.0)  # Only bad citations

    # 2. Author/year verification against sources
    source_authors = set()
    source_years = set()
    for s in sources:
        authors_field = s.get("authors")
        if authors_field:
            if isinstance(authors_field, list):
                author_list = authors_field
            else:
                author_list = re.split(r'[,;]\s*', str(authors_field))
            for a in author_list:
                if isinstance(a, str):
                    words = [w.strip(".,()[]\"'").lower() for w in a.split()]
                    for w in words:
                        if len(w) >= 2 and not w.isdigit() and w not in ("et", "al", "and"):
                            source_authors.add(w)
        year = s.get("year") or s.get("publication_year")
        if year:
            source_years.add(str(year))

    verified = 0
    for author_text, year in proper_citations:
        author_tokens = [w.strip(".,()[]\"'").lower() for w in author_text.split() if w.lower() not in ("et", "al", "and", "&")]
        author_match = any(t in source_authors for t in author_tokens)
        year_match = year in source_years
        if author_match or year_match:
            verified += 1

    if proper_citations:
        score_components.append(min(1.0, verified / len(proper_citations)))
    else:
        score_components.append(0.0)

    # 3. Coverage: every non-trivial paragraph should have a citation
    paragraphs = [p.strip() for p in answer.split('\n') if len(p.strip()) > 80]
    if paragraphs:
        cited_paragraphs = sum(
            1 for p in paragraphs if re.search(r'\[.*?\d{4}\]', p)
        )
        score_components.append(cited_paragraphs / len(paragraphs))
    else:
        # Short answer — less strict about paragraph coverage
        if proper_citations:
            score_components.append(1.0)
        else:
            score_components.append(0.5)

    return round(sum(score_components) / len(score_components), 4) if score_components else 0.0


def score_canary_response(answer: str, expected_behavior: str) -> bool:
    """
    Check if system correctly handled a canary question.
    Returns True if the system correctly abstained/rejected.
    """
    if not answer or len(answer.strip()) < 30:
        return True  # Very short or empty = effectively abstained

    abstain_indicators = [
        "i don't have",
        "no information",
        "not found in",
        "cannot find",
        "outside the scope",
        "don't have access",
        "no relevant documents",
        "not available in",
        "i'm unable to",
        "beyond the scope",
        "no evidence in",
        "not covered",
        "no publications",
        "no studies found",
        "i cannot provide",
    ]
    answer_lower = answer.lower()
    for indicator in abstain_indicators:
        if indicator in answer_lower:
            return True

    # If the system gave a substantive answer (>200 chars without abstain indicators),
    # it likely hallucinated
    if len(answer.strip()) > 200:
        return False

    return True  # Ambiguous short responses treated as abstention


# ─── DeepEval Integration ────────────────────────────────────────────────────

def _get_deepeval_judge(api_key: str = None, model_name: str = None):
    """Create a DeepEval-compatible judge model backed by Mistral."""
    api_key = api_key or os.environ.get("MISTRAL_API_KEY")
    model_name = model_name or EVAL_CONFIG["default_judge"]

    if not api_key:
        logger.warning("MISTRAL_API_KEY not set — DeepEval judge unavailable.")
        return None

    try:
        from deepeval.models import DeepEvalBaseLLM
        from deepeval.metrics.utils import trimAndLoadJson
        from pydantic import BaseModel
        from typing import Tuple, Union

        try:
            from mistralai.client import Mistral
        except ImportError:
            from mistralai import Mistral

        class MistralEvalJudge(DeepEvalBaseLLM):
            def __init__(self, key: str, model: str):
                self.api_key = key
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

            def generate(self, prompt: str, schema: BaseModel = None, **kwargs) -> Tuple[Union[str, BaseModel], float]:
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

            async def a_generate(self, prompt: str, schema: BaseModel = None, **kwargs) -> Tuple[Union[str, BaseModel], float]:
                return self.generate(prompt, schema, **kwargs)

        return MistralEvalJudge(key=api_key, model=model_name)
    except Exception as e:
        logger.warning(f"Failed to create DeepEval judge: {e}")
        return None


def run_deepeval_metrics(test_case_data: dict, judge_model) -> dict:
    """
    Run DeepEval metrics on a single test case.
    Returns dict of metric_name -> score (0.0-1.0).
    """
    scores = {}
    try:
        from deepeval.metrics import (
            FaithfulnessMetric,
            AnswerRelevancyMetric,
            ContextualPrecisionMetric,
            ContextualRecallMetric,
        )
        from deepeval.test_case import LLMTestCase

        tc_kwargs = {
            "input": test_case_data["input_query"],
            "actual_output": test_case_data.get("actual_output", ""),
            "retrieval_context": test_case_data.get("retrieval_context", []),
        }
        if test_case_data.get("expected_output"):
            tc_kwargs["expected_output"] = test_case_data["expected_output"]

        test_case = LLMTestCase(**tc_kwargs)

        # Faithfulness
        try:
            fm = FaithfulnessMetric(threshold=0.0, model=judge_model)
            fm.measure(test_case)
            scores["faithfulness"] = round(fm.score, 4) if fm.score is not None else None
        except Exception as e:
            logger.warning(f"Faithfulness metric failed: {e}")
            scores["faithfulness"] = None

        # Answer Relevancy
        try:
            ar = AnswerRelevancyMetric(threshold=0.0, model=judge_model)
            ar.measure(test_case)
            scores["answer_relevancy"] = round(ar.score, 4) if ar.score is not None else None
        except Exception as e:
            logger.warning(f"Answer Relevancy metric failed: {e}")
            scores["answer_relevancy"] = None

        # Context Precision
        try:
            cp = ContextualPrecisionMetric(threshold=0.0, model=judge_model)
            cp.measure(test_case)
            scores["context_precision"] = round(cp.score, 4) if cp.score is not None else None
        except Exception as e:
            logger.warning(f"Context Precision metric failed: {e}")
            scores["context_precision"] = None

        # Context Recall (requires expected_output)
        if test_case_data.get("expected_output"):
            try:
                cr = ContextualRecallMetric(threshold=0.0, model=judge_model)
                cr.measure(test_case)
                scores["context_recall"] = round(cr.score, 4) if cr.score is not None else None
            except Exception as e:
                logger.warning(f"Context Recall metric failed: {e}")
                scores["context_recall"] = None
        else:
            scores["context_recall"] = None

    except ImportError:
        logger.error("deepeval not installed. Run: pip install deepeval>=0.21.0")
    except Exception as e:
        logger.error(f"DeepEval metrics failed: {e}")

    return scores


# ─── Main Evaluation Engine ─────────────────────────────────────────────────

class EvaluationEngine:
    """Runs comprehensive RAG evaluation against the live acAIcia backend."""

    def __init__(self, supabase_client, backend_url: str, judge_model_name: str = None):
        self.supabase = supabase_client
        self.backend_url = backend_url.rstrip("/")
        self.judge_model_name = judge_model_name or EVAL_CONFIG["default_judge"]
        self.judge = None  # Lazy init

    def _get_judge(self):
        if self.judge is None:
            self.judge = _get_deepeval_judge(model_name=self.judge_model_name)
        return self.judge

    def load_dataset(self, dataset_name: str, limit: int = None,
                     include_canaries: bool = True) -> list:
        """Load evaluation questions from CSV + optional canary questions."""
        questions = []

        # Load from CSV file (checking multiple candidate locations)
        csv_path = None
        candidate_paths = [
            DATASETS_DIR / dataset_name,
            Path.cwd() / dataset_name,
            Path(__file__).resolve().parent.parent / dataset_name,
            Path("/root") / dataset_name,
            Path("/data") / dataset_name,
        ]
        for p in candidate_paths:
            try:
                if p.exists() and p.is_file():
                    csv_path = p
                    break
            except OSError:
                continue

        if csv_path:
            questions.extend(load_csv_dataset(csv_path, limit=limit))
            logger.info(f"Loaded {len(questions)} questions from {csv_path}")
        else:
            logger.warning(f"Dataset file not found in candidates: {dataset_name}. Using built-in sample benchmark.")
            fallback = [
                {
                    "input_query": "What percentage of Ghana’s total national anthropogenic GHG emissions come from food systems?",
                    "expected_output": "54.1%",
                    "target_title": "Opportunities for a low-emission transformation of Ghana’s food systems",
                    "target_doi": "10.17528/cifor-icraf/009417",
                    "question_type": "standard",
                    "source_dataset": "builtin_benchmark",
                },
                {
                    "input_query": "According to the report, what share of global anthropogenic greenhouse gas emissions are attributed to food systems?",
                    "expected_output": "about one-third",
                    "target_title": "Towards low-emission food systems in Ghana: A country profile",
                    "target_doi": "10.17528/cifor-icraf/009412",
                    "question_type": "standard",
                    "source_dataset": "builtin_benchmark",
                },
                {
                    "input_query": "During the 58-day dry period monitored in South Sumatra, what was the maximum groundwater depth reached?",
                    "expected_output": "78.5 cm",
                    "target_title": "Peat Hydrological Properties and Vulnerability to Fire Risk",
                    "target_doi": "10.3390/fire9010024",
                    "question_type": "standard",
                    "source_dataset": "builtin_benchmark",
                },
                {
                    "input_query": "By what percentage did respiratory clinic visits increase during fire-haze days in Pulang Pisau Regency?",
                    "expected_output": "74.4%",
                    "target_title": "Effects of smoke haze on respiratory clinic visits in Central Kalimantan, Indonesia according to different haze characteristics",
                    "target_doi": "10.1093/ije/dyaf169",
                    "question_type": "standard",
                    "source_dataset": "builtin_benchmark",
                },
                {
                    "input_query": "How many prescribed burn records does the GlobalRx dataset contain?",
                    "expected_output": "204,517",
                    "target_title": "A global assemblage of regional prescribed burn records — GlobalRx",
                    "target_doi": "10.1038/s41597-025-04941-w",
                    "question_type": "standard",
                    "source_dataset": "builtin_benchmark",
                }
            ]
            questions.extend(fallback[:limit] if limit else fallback)

        # Load canary questions
        if include_canaries:
            canaries = load_canary_questions(self.supabase)
            questions.extend(canaries)
            logger.info(f"Loaded {len(canaries)} canary questions")

        return questions

    def query_backend(self, question: str, session_id: str = None) -> dict:
        """
        Submit question to live backend, poll for completion.
        Returns: dict with answer, sources, latency_ms, cache_hit
        """
        timeout = EVAL_CONFIG["backend_timeout_sec"]
        poll_interval = EVAL_CONFIG["poll_interval_sec"]

        try:
            # Submit query
            r = requests.post(
                f"{self.backend_url}/query",
                json={
                    "query": question,
                    "guest_session_id": f"eval-{session_id or 'run'}",
                    "session_id": session_id,
                },
                timeout=30
            )
            r.raise_for_status()
            query_id = r.json().get("query_id")
            if not query_id:
                return {"answer": "", "sources": [], "latency_ms": 0, "cache_hit": False}

            # Poll for completion
            start_t = time.time()
            deadline = start_t + timeout
            while time.time() < deadline:
                try:
                    status_r = requests.get(
                        f"{self.backend_url}/query/status/{query_id}",
                        timeout=10
                    )
                    if status_r.status_code == 200:
                        data = status_r.json()
                        if data.get("status") == "completed":
                            elapsed_ms = int((time.time() - start_t) * 1000)
                            sources = data.get("sources", [])
                            return {
                                "answer": data.get("response", ""),
                                "sources": sources,
                                "latency_ms": elapsed_ms,
                                "cache_hit": data.get("cache_hit", False),
                                "retrieval_context": [
                                    s.get("snippet", s.get("title", ""))
                                    for s in sources if s
                                ],
                            }
                        elif data.get("status") == "failed":
                            return {"answer": "", "sources": [], "latency_ms": 0, "cache_hit": False}
                except requests.RequestException:
                    pass
                time.sleep(poll_interval)

            logger.warning(f"Query timed out after {timeout}s: {question[:60]}...")
            return {"answer": "", "sources": [], "latency_ms": int(timeout * 1000), "cache_hit": False}

        except Exception as e:
            logger.error(f"Backend query failed: {e}")
            return {"answer": "", "sources": [], "latency_ms": 0, "cache_hit": False}

    def evaluate_question(self, question: dict, index: int,
                          use_deepeval: bool = True) -> dict:
        """
        Evaluate a single question through the full pipeline.
        Returns a detail record dict.
        """
        q_text = question["input_query"]
        q_type = question.get("question_type", "standard")
        logger.info(f"  [{index}] [{q_type.upper():10s}] {q_text[:70]}...")

        # Query the live backend
        result = self.query_backend(q_text)
        answer = result["answer"]
        sources = result["sources"]
        latency_ms = result["latency_ms"]
        retrieval_context = result.get("retrieval_context", [])

        detail = {
            "question_index": index,
            "input_query": q_text,
            "expected_output": question.get("expected_output"),
            "actual_output": answer,
            "retrieval_context": retrieval_context[:5],
            "latency_ms": latency_ms,
            "question_type": q_type,
            "topic_category": question.get("topic_category"),
            "source_dataset": question.get("source_dataset"),
            "target_doi": question.get("target_doi"),
        }

        if not answer:
            logger.warning(f"  [{index}] No response from backend, skipping scoring.")
            return detail

        # === Canary evaluation ===
        if q_type == "canary":
            expected_behavior = question.get("expected_behavior", "abstain")
            correctly_handled = score_canary_response(answer, expected_behavior)
            detail["notes"] = f"canary_handled={'correct' if correctly_handled else 'VIOLATION'}"
            if correctly_handled:
                detail["faithfulness"] = 1.0
                detail["answer_relevancy"] = 1.0
            else:
                detail["faithfulness"] = 0.0
                detail["answer_relevancy"] = 0.0
            return detail

        # === Citation quality (custom metric) ===
        detail["citation_quality"] = score_citation_quality(answer, sources)

        # === Hit@k (retrieval accuracy) ===
        target_title = (question.get("target_title") or "").lower()
        target_doi = (question.get("target_doi") or "").lower()
        if target_title or target_doi:
            for rank, s in enumerate(sources):
                title = (s.get("title") or "").lower()
                doi = (s.get("doi") or "").lower()
                is_match = (target_title and target_title in title) or \
                           (target_doi and target_doi in doi)
                if is_match:
                    if rank == 0:
                        detail["hit_at_1"] = True
                    detail["hit_at_5"] = True
                    break
            if "hit_at_5" not in detail:
                detail["hit_at_1"] = False
                detail["hit_at_5"] = False

        # === DeepEval metrics ===
        if use_deepeval:
            judge = self._get_judge()
            if judge:
                deepeval_scores = run_deepeval_metrics({
                    "input_query": q_text,
                    "actual_output": answer,
                    "expected_output": question.get("expected_output"),
                    "retrieval_context": retrieval_context,
                }, judge)
                detail.update(deepeval_scores)

        return detail

    def run_evaluation(self, dataset_name: str = "test_questions.csv",
                       run_type: str = "manual", triggered_by: str = "cli",
                       limit: int = None, run_id: str = None,
                       eval_mode: str = "full",
                       include_canaries: bool = True) -> dict:
        """
        Execute a full evaluation run.
        Returns summary dict with run_id, scores, pass/fail.
        """
        run_id = run_id or str(uuid.uuid4())
        start_time = time.time()
        use_deepeval = eval_mode not in ["retrieval_only", "fast_smoke"]
        if eval_mode == "fast_smoke" and limit is None:
            limit = 3

        logger.info(f"\n{'='*60}")
        logger.info(f"  acAIcia Evaluation Run: {run_id[:8]}...")
        logger.info(f"  Dataset: {dataset_name} | Mode: {eval_mode}")
        logger.info(f"  Judge: {self.judge_model_name} | Triggered by: {triggered_by}")
        logger.info(f"{'='*60}\n")

        # 1. Create or upsert evaluation_runs record with status='running'
        try:
            self.supabase.table("evaluation_runs").upsert({
                "run_id": run_id,
                "dataset_name": dataset_name,
                "num_questions": 0,
                "hit_rate_at_5": 0.0,
                "context_precision": 0.0,
                "avg_latency_ms": 0.0,
                "model_provider": self.judge_model_name,
                "run_type": run_type,
                "eval_mode": eval_mode,
                "judge_model": self.judge_model_name,
                "triggered_by": triggered_by,
                "status": "running",
                "config": {
                    "dataset": dataset_name,
                    "limit": limit,
                    "eval_mode": eval_mode,
                    "thresholds": EVAL_CONFIG["thresholds"],
                },
            }).execute()
        except Exception as e:
            logger.error(f"Failed to create/upsert eval run record: {e}")

        # 2. Load dataset
        questions = self.load_dataset(
            dataset_name, limit=limit,
            include_canaries=include_canaries and eval_mode != "retrieval_only"
        )
        if not questions:
            logger.error("No questions loaded — aborting evaluation.")
            self._update_run_status(run_id, "failed", 0, start_time, {})
            return {"run_id": run_id, "status": "failed", "error": "No questions loaded."}

        # 3. Evaluate each question
        details = []
        for idx, q in enumerate(questions, 1):
            try:
                detail = self.evaluate_question(q, idx, use_deepeval=use_deepeval)
                detail["run_id"] = run_id
                details.append(detail)
            except Exception as e:
                logger.error(f"  [{idx}] Error evaluating question: {e}")
                details.append({
                    "run_id": run_id,
                    "question_index": idx,
                    "input_query": q.get("input_query", ""),
                    "question_type": q.get("question_type", "standard"),
                    "notes": f"evaluation_error: {str(e)}",
                })

        # 4. Insert evaluation_details rows
        for d in details:
            try:
                # Clean up None values and ensure proper types
                insert_row = {k: v for k, v in d.items() if v is not None}
                self.supabase.table("evaluation_details").insert(insert_row).execute()
            except Exception as e:
                logger.warning(f"Failed to insert detail row: {e}")

        # 5. Compute aggregates
        summary = self._compute_summary(details)
        summary["run_id"] = run_id
        summary["num_questions"] = len(details)
        summary["duration_sec"] = round(time.time() - start_time, 1)

        # 6. Determine pass/fail
        thresholds = EVAL_CONFIG["thresholds"]
        passed = True
        fail_reasons = []

        for metric_name, threshold in thresholds.items():
            metric_key = f"avg_{metric_name}" if not metric_name.startswith("hit_") else metric_name
            actual = summary.get(metric_key)
            if actual is not None and actual < threshold:
                passed = False
                fail_reasons.append(f"{metric_name}: {actual:.3f} < {threshold}")

        canary_violations = summary.get("canary_violations", 0)
        if canary_violations > EVAL_CONFIG["canary_max_violations"]:
            passed = False
            fail_reasons.append(f"canary_violations: {canary_violations}")

        summary["passed"] = passed
        summary["fail_reasons"] = fail_reasons

        # 7. Update evaluation_runs with final scores
        self._update_run_status(run_id, "completed", len(details), start_time, summary)

        # Log results
        logger.info(f"\n{'='*60}")
        logger.info(f"  EVALUATION RESULTS: {'✅ PASSED' if passed else '❌ FAILED'}")
        logger.info(f"  Questions: {len(details)} | Duration: {summary['duration_sec']}s")
        for k, v in summary.items():
            if k.startswith("avg_") and v is not None:
                logger.info(f"  {k}: {v:.4f}")
        if fail_reasons:
            logger.info(f"  Fail reasons: {fail_reasons}")
        logger.info(f"{'='*60}\n")

        return summary

    def _compute_summary(self, details: list) -> dict:
        """Compute aggregate scores from detail rows."""
        def avg_field(field):
            vals = [d[field] for d in details if d.get(field) is not None]
            return round(sum(vals) / len(vals), 4) if vals else None

        standard_details = [d for d in details if d.get("question_type") != "canary"]
        canary_details = [d for d in details if d.get("question_type") == "canary"]

        hit_at_5_count = sum(1 for d in standard_details if d.get("hit_at_5"))
        hit_at_1_count = sum(1 for d in standard_details if d.get("hit_at_1"))
        total_with_hit = sum(1 for d in standard_details if d.get("hit_at_5") is not None)

        canary_violations = sum(
            1 for d in canary_details
            if d.get("notes") and "VIOLATION" in d.get("notes", "")
        )

        latencies = [d["latency_ms"] for d in details if d.get("latency_ms")]

        return {
            "avg_faithfulness": avg_field("faithfulness"),
            "avg_answer_relevancy": avg_field("answer_relevancy"),
            "avg_context_precision": avg_field("context_precision"),
            "avg_context_recall": avg_field("context_recall"),
            "avg_citation_quality": avg_field("citation_quality"),
            "hit_rate_at_5": round((hit_at_5_count / total_with_hit) * 100, 2) if total_with_hit else None,
            "hit_rate_at_1": round((hit_at_1_count / total_with_hit) * 100, 2) if total_with_hit else None,
            "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else None,
            "canary_violations": canary_violations,
            "canary_total": len(canary_details),
        }

    def _update_run_status(self, run_id: str, status: str, num_questions: int,
                           start_time: float, summary: dict):
        """Update the evaluation_runs record with final results."""
        duration = round(time.time() - start_time, 1)
        details_obj = {
            "status": status,
            "duration_sec": duration,
            "passed": summary.get("passed"),
            "avg_faithfulness": summary.get("avg_faithfulness"),
            "avg_answer_relevancy": summary.get("avg_answer_relevancy"),
            "avg_citation_quality": summary.get("avg_citation_quality"),
            "canary_violations": summary.get("canary_violations"),
            "fail_reasons": summary.get("fail_reasons", []),
        }
        try:
            update_data = {
                "status": status,
                "num_questions": num_questions,
                "duration_sec": duration,
                "passed": summary.get("passed"),
                "hit_rate_at_5": summary.get("hit_rate_at_5", 0.0) or 0.0,
                "context_precision": summary.get("avg_context_precision", 0.0) or 0.0,
                "avg_latency_ms": summary.get("avg_latency_ms", 0.0) or 0.0,
                "details": details_obj,
            }
            try:
                self.supabase.table("evaluation_runs") \
                    .update(update_data).eq("run_id", run_id).execute()
            except Exception as extended_err:
                logger.warning(f"Extended update on evaluation_runs failed ({extended_err}); falling back to base columns.")
                base_data = {
                    "num_questions": num_questions,
                    "hit_rate_at_5": summary.get("hit_rate_at_5", 0.0) or 0.0,
                    "context_precision": summary.get("avg_context_precision", 0.0) or 0.0,
                    "avg_latency_ms": summary.get("avg_latency_ms", 0.0) or 0.0,
                    "details": details_obj,
                }
                self.supabase.table("evaluation_runs") \
                    .update(base_data).eq("run_id", run_id).execute()
        except Exception as e:
            logger.error(f"Failed to update eval run {run_id}: {e}")


# ─── CLI Entrypoint ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    from supabase import create_client

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )

    parser = argparse.ArgumentParser(description="acAIcia Evaluation Engine CLI")
    parser.add_argument("--dataset", default="test_questions.csv",
                        help="CSV dataset filename (relative to repo root)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max number of standard questions to evaluate")
    parser.add_argument("--mode", default="full",
                        choices=["full", "retrieval_only", "fast_smoke"],
                        help="Evaluation mode")
    parser.add_argument("--backend-url", default=None,
                        help="Backend API URL (default: Modal production)")
    parser.add_argument("--judge-model", default=None,
                        help="LLM judge model name")
    parser.add_argument("--no-canaries", action="store_true",
                        help="Skip canary questions")
    args = parser.parse_args()

    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY environment variables required.")
        raise SystemExit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    backend_url = args.backend_url or os.environ.get(
        "ACAICIA_BACKEND_URL",
        "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run"
    )

    engine = EvaluationEngine(
        supabase_client=supabase,
        backend_url=backend_url,
        judge_model_name=args.judge_model,
    )

    result = engine.run_evaluation(
        dataset_name=args.dataset,
        run_type="manual",
        triggered_by="cli",
        limit=args.limit,
        eval_mode=args.mode,
        include_canaries=not args.no_canaries,
    )

    print(json.dumps(result, indent=2, default=str))
