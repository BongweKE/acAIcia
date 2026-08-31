# ADR 0004: Serverless Multi-Agent RAG Architecture on Modal Cloud

- **Status**: Approved & Implemented
- **Date**: 2026-08-18
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

Evidence synthesis queries require specialized steps: validating request scope, expanding entity-dense search strings, executing hybrid vector/text retrieval, and synthesizing academic answers with strict `[Author(s), Year]` citations. Traditional monolithic single-prompt RAG suffered from hallucinated citations, off-topic requests, and poor search recall.

---

## 2. Decision Drivers

1. **Agent Specialization**: Separation of concerns into dedicated agent roles (Guardian, Query Architect, Hybrid Retrieval, Synthesis).
2. **Serverless Auto-Scaling**: High-concurrency query execution without maintaining fixed server infrastructure.
3. **Multi-Provider LLM Routing**: Flexibility to switch or combine LLM engines (Google Gemini 2.5 Flash, NVIDIA NIM Llama 3.3, DeepSeek Reasoner, and self-hosted Modal Gemma 4).
4. **Asynchronous Background Processing**: FastAPI `/query` endpoint returns `query_id` immediately; query processing runs asynchronously in Modal tasks with persistent state reporting.

---

## 3. Decision Outcome

Selected **Modal Cloud** (`modal.App("acaicia-backend")`) as the serverless hosting layer:
* **FastAPI Entrypoint**: `@modal.fastapi_endpoint` handling incoming client REST requests.
* **Concurrent Worker Execution**: `@modal.concurrent(max_inputs=16)` scaling worker containers dynamically based on incoming traffic.
* **Persistent Volumes**: `modal.Volume("acaicia-data-volume")` for runtime settings and `modal.Volume("acaicia-hf-cache")` for caching local SentenceTransformer embeddings (`BAAI/bge-base-en-v1.5`).
* **Cron Jobs**: `modal.Cron("0 2 * * *")` running nightly automated RAG evaluation benchmarks and cache warmup.

---

## 4. Consequences

* **Positive**:
  * High-concurrency parallel agent execution (Guardian and Query Architect execute concurrently via Python `ThreadPoolExecutor`).
  * Instant auto-scaling and zero-idle infrastructure costs.
  * Modular LLM provider switching controlled dynamically via admin volume settings (`/data/settings.json`).
* **Negative**:
  * Cold-start latency when scaling up container instances from zero (mitigated by nightly warmup cron).
