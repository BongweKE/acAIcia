# acAIcia RAG Evaluation Architecture & Operations Guide

This guide details the evaluation subsystem for **acAIcia** (AI Research Assistant for Landscape Alliance / CIFOR-ICRAF). It explains the underlying architecture, custom metrics, executive framework decisions, testing instructions, and procedures for expanding benchmarks and metrics.

---

## 🏛️ 1. Architecture Overview

acAIcia's evaluation subsystem provides automated continuous evaluation and on-demand observability for the multi-agent RAG pipeline.

```
                              +---------------------------------------------+
                              |         Admin Dashboard UI (/admin)         |
                              |   (EvaluationsTab & EvalRunDetailModal)     |
                              +----------------------+----------------------+
                                                     |
                                                     | POST /admin/evaluations/trigger
                                                     | GET /admin/evaluations/trends
                                                     | GET /admin/evaluations/{run_id}/details
                                                     v
                              +---------------------------------------------+
                               |         FastAPI Admin Endpoints             |
                               |              (backend/server.py)              |
                              +----------------------+----------------------+
                                                     |
                          +--------------------------+--------------------------+
                          |                                                     |
                          v                                                     v
+------------------------------------+                +------------------------------------+
|  Weekly Comparative Cron (legacy)  |                |   Async Evaluation Worker          |
|   Modal-only: modal.Cron("0 2 * * 0")|               |  (background thread on Railway)    |
|   (Modal Gemma vs Mistral API)     |                |  (backend/evaluation_engine.py)    |
+-----------------+------------------+                +-----------------+------------------+
                  |                                                     |
                  +--------------------------+--------------------------+
                                             |
                                             v
                              +---------------------------------------------+
                              |        Supabase Persistence Layer           |
                              |   - evaluation_runs                         |
                              |   - evaluation_details                      |
                              |   - canary_questions                        |
                              |   - evaluation_score_trends (SQL View)      |
                              +---------------------------------------------+
```

### Components

1. **Evaluation Engine (`backend/evaluation_engine.py`)**: Core evaluation runner executing test datasets, coordinating LLM judge scoring, calculating custom citation quality and canary abstention scores, and persisting detailed per-question results.
2. **Database Schema (`database/migrations/005_evaluation_system.sql`)**:
   - `evaluation_runs`: High-level run records with status, execution duration, total cost, aggregate metrics, and pass/fail verdicts.
   - `evaluation_details`: Per-question rows recording input query, expected output, actual output, retrieval context excerpts, latency, Hit@1/5, and metric scores.
   - `canary_questions`: Active registry of unanswerable / out-of-domain canary queries to detect ungrounded hallucinations.
   - `evaluation_score_trends`: SQL view aggregating metrics over time for admin dashboard charts.
3. **Weekly Comparative Cron (`backend/app.py`, legacy Modal only)**: Scheduled via `modal.Cron("0 2 * * 0")` (Sundays at 02:00 UTC). Compares self-hosted Modal Gemma against Mistral. **Does not run on Railway** — the Railway backend runs Mistral-only, admin-triggered evaluations in a background thread.
4. **Admin Observability UI (`frontend/src/components/admin/`)**:
   - `EvaluationsTab.tsx`: Score rings (Faithfulness, Relevance, Precision, Citation Quality, Canary Violations), historical trend line charts, on-demand trigger controls with mode and dataset selection.
   - `EvalRunDetailModal.tsx`: Per-question drill-down table with expected vs actual output inspection and retrieval chunk review.

---

## ⚖️ 2. Executive Decision: Evaluation Framework (L74)

### Core Engine: DeepEval + Custom Validated Metrics

For acAIcia's core production evaluation pipeline, the executive decision is to maintain **DeepEval** coupled with lightweight custom heuristic and rule-based metrics, rather than adopting heavy external orchestration frameworks:

1. **Lightweight Dependency Footprint**: DeepEval integrates directly with Pydantic and custom LLM judges without pulling in hundreds of transient dependencies or heavy tracing daemons.
2. **Deterministic Domain Guardrails**: Academic RAG requires strict domain rules (e.g. `[Author, Year]` citations, author verification against internal catalog, canary abstention) that generalist RAG frameworks do not assess out-of-the-box.
3. **Cost & Latency Control**: DeepEval metrics can be conditionally bypassed (`fast_smoke` and `retrieval_only` modes) to enable instant sanity checks in seconds without burning LLM judge tokens.
4. **Comparative Architecture**: The runner natively supports multi-model comparison (e.g. Modal self-hosted GPU models vs Cloud API models) on identical benchmark queries.

### Framework Expansion Roadmap

For future development or external research benchmarking:
- **Ragas**: Can be integrated by passing retrieved chunks and answers to `ragas.evaluate()`. Ragas is documented in the codebase (`production_eval_scores` table), and can be used for secondary batch verification.
- **TruLens**: Useful for feedback functions (groundedness, context relevance) if instrumenting OpenTelemetry spans.
- **Arize Phoenix / LangSmith**: Tracing exporters can be attached to `query_interaction_logs` for real-time production query tracing.

---

## 📊 3. Metric Taxonomy & Scoring Rules

| Metric | Type | Scale | Target Threshold | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Faithfulness** | LLM Judge | 0.0 – 1.0 | `>= 0.70` | Evaluates whether claims in the synthesized answer are strictly grounded in retrieved document excerpts. |
| **Answer Relevancy** | LLM Judge | 0.0 – 1.0 | `>= 0.70` | Measures how directly the response addresses the researcher's query without tangential elaboration. |
| **Context Precision** | LLM Judge | 0.0 – 1.0 | `>= 0.65` | Assesses whether the highest-ranked retrieved document chunks contain the ground-truth information. |
| **Context Recall** | LLM Judge | 0.0 – 1.0 | `>= 0.60` | Evaluates whether all essential facts needed to answer the question were successfully retrieved. |
| **Citation Quality** | Heuristic / Rule | 0.0 – 1.0 | `>= 0.75` | Enforces `[Author(s), Year]` syntax, verifies authors and publication years against source catalog, penalizes document numbers (`[1]`). |
| **Hit Rate @ 5** | Retrieval Rank | 0% – 100% | `>= 75.0%` | Percentage of test questions where the target publication appeared within the top 5 retrieved chunks. |
| **Canary Violations** | Deterministic | Count | `<= 1` | Flags when the system hallucinates an answer to a question known to be absent from the knowledge base rather than abstaining. |

### Citation Quality Scoring Protocol

`score_citation_quality(answer, sources)` enforces:
1. **Format Validation**: Looks for `[Author(s), Year]` patterns (e.g. `[Hoang et al., 2010]`). Rejects bracketed document numbers (e.g. `[1]`, `[Document 2]`).
2. **Source Cross-Verification**: Extracted author surnames and publication years are verified against metadata in retrieved source chunks.
3. **Paragraph Coverage**: Every substantive explanatory paragraph (>80 characters) must contain at least one valid citation.

---

## 🚀 4. How to Run Evaluations

### A. From the Admin Dashboard UI (Recommended)

1. Log in to the Admin Dashboard at `/admin` (requires admin passphrase).
2. Navigate to the **Evaluations & Alerts** tab.
3. Configure the trigger toolbar:
   - **Dataset**: Select target CSV (e.g. `test_questions.csv`, `test_questions_difficult.csv`, `test_questions_fire_mgt.csv`, `test_question_soils.csv`).
   - **Limit**: Choose question count (e.g. `5` for quick test, `20` for standard benchmark).
   - **Mode**:
     - `full`: Complete evaluation with DeepEval LLM judge, custom metrics, and canary checks.
     - `fast_smoke`: Rapid sanity check (bypasses LLM judge; runs in 5–10 seconds).
     - `retrieval_only`: Tests search recall and Hit@k without full answer generation.
4. Click **Run Evaluation**.
5. When completed, click any run in the **Recent Evaluation Runs** list to inspect per-question details.

### B. From the CLI

Run the evaluation engine directly against the live backend:

```bash
# Full evaluation with 10 questions
.venv/bin/python -m backend.evaluation_engine --dataset test_questions.csv --limit 10

# Fast smoke mode (no LLM judge)
.venv/bin/python -m backend.evaluation_engine --dataset test_questions.csv --limit 5 --mode fast_smoke

# Retrieval-only mode against custom backend URL
.venv/bin/python -m backend.evaluation_engine \
  --dataset test_questions_fire_mgt.csv \
  --mode retrieval_only \
  --backend-url https://acaicia-backend-production.up.railway.app
```

### C. In CI / Automated Tests

Execute the unit test suite:

```bash
# Run evaluation system unit and integration tests
.venv/bin/python -m unittest tests/test_evaluation_system.py -v

# Run DeepEval offline test suite
.venv/bin/pytest tests/deepeval_suite.py -v -k "offline"
```

---

## 🔄 5. Weekly Comparative Evaluation (Modal Cron)

The scheduled cron runs weekly on Sundays at 02:00 UTC (`modal.Cron("0 2 * * 0")`):

1. Retrieves benchmark Q&A pairs representing core research disciplines (Ghana Food Systems, South Sumatra Peatlands, Pulang Pisau Fire-Haze, GlobalRx Burn Records).
2. Generates academic answers using **Modal self-hosted Gemma** and **Mistral API (`ministral-8b-latest`)**.
3. Calculates citation quality scores and response latencies for both models.
4. Logs a comparative run record in `evaluation_runs` with `run_type="comparative_weekly_cron"` and stores detailed side-by-side responses in `evaluation_details`.
5. Updates dynamic research prompt pills from `documents_catalog` to keep landing page pills fresh.

---

## 🛠️ 6. How to Expand the Evaluation Benchmark

### Adding New Test Datasets

1. Create a CSV file in the repository root (e.g. `test_questions_biodiversity.csv`).
2. Format the CSV with the standard schema:
   ```csv
   document_title,doi,test_question,expected_answer
   "Tree species diversity in West Africa","10.17528/cifor-icraf/009999","What is the mean canopy density?","68.4%"
   ```
3. Add the dataset option to `frontend/src/components/admin/EvaluationsTab.tsx`:
   ```tsx
   <option value="test_questions_biodiversity.csv">test_questions_biodiversity.csv</option>
   ```

### Registering Canary Questions

Canary questions are ungrounded or out-of-domain queries designed to ensure the assistant abstains rather than hallucinating:

```sql
INSERT INTO canary_questions (question_text, topic_category, expected_behavior)
VALUES ('What was the timber export revenue of the Roman Empire in 100 CE?', 'forestry', 'abstain');
```

The system automatically loads all active canary questions (`WHERE is_active = TRUE`) during full evaluation runs.

### Implementing a New Custom Metric

To add a new custom metric (e.g., terminology fidelity or scientific entity preservation):
1. Define the metric function in `backend/evaluation_engine.py`:
   ```python
   def score_terminology_fidelity(answer: str, target_species: list) -> float:
       if not target_species:
           return 1.0
       present = sum(1 for s in target_species if s.lower() in answer.lower())
       return round(present / len(target_species), 4)
   ```
2. Call the function inside `evaluate_question()`:
   ```python
   detail["terminology_fidelity"] = score_terminology_fidelity(answer, question.get("species", []))
   ```
3. Add the column to `database/migrations/005_evaluation_system.sql` and update TypeScript types in `frontend/src/types/index.ts`.
