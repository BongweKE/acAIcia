# acAIcia E2E Test Infrastructure & 4-Tier Quality Assurance Specification

## 1. Overview & Dual Track Principles

The **acAIcia** application is undergoing a frontend migration from Chainlit (Python) to a modern React 18 + Vite + TypeScript + Tailwind CSS Single Page Application (SPA). To guarantee high reliability, zero regression, and strict contract adherence throughout this migration, this End-to-End (E2E) Test Infrastructure is built on **Dual Track Testing Principles** defined in `PROJECT.md`.

### Dual Track Architectural Principles
1. **Track 1: API Interface Contract Validation (Backend & Engine Track)**
   - Operates as an opaque-box test suite targeting all FastAPI backend endpoints (`/query`, `/query/status/{id}`, `/prompt_pills`, `/settings`, `/user/settings`, `/feedback`, `/admin/metrics`).
   - Verifies response structures, JSON schema types, HTTP status codes, error payloads, and multi-agent stage timing metadata.
   - Supports both an in-memory FastAPI mock server (`TEST_MODE=mock`) for fast, deterministic CI pipeline execution and live backend deployment testing (`TEST_MODE=live`).

2. **Track 2: UI State Logic & User Workflow Validation (Frontend SPA Track)**
   - Validates client-side state contracts, user session rules, role-based access control (RBAC), and interactive feature behaviors.
   - Enforces business rules: Guest mode query limits (max 20 queries), guest LLM provider locking (`modal` Gemma 4), authenticated researcher features (provider unlocking for `gemini`, `nvidia`, `deepseek`, custom instructions injection), citation formatting (`[Author, Year]`), and admin observability metrics.

---

## 2. Test Philosophy & Design Rules

- **Opaque-Box Testing**: Tests interact with endpoints and state logic via public interfaces without relying on private implementation details.
- **Dual Mode Support**:
  - `TEST_MODE=mock` (Default): Uses `fastapi.testclient.TestClient` with a stateful in-memory mock engine that mimics full multi-agent backend behavior deterministically.
  - `TEST_MODE=live`: Direct HTTP calls via `requests` to a deployed FastAPI instance (e.g. Modal production endpoint).
- **Zero Flakiness Guarantee**: Mock mode provides deterministic responses for RAG stages, Guardian guardrail checks, citation generation, and latency calculations.
- **Detailed Assertion Diagnostics**: Failed tests produce readable failure reports detailing expected vs actual payloads, status codes, and line locations.

---

## 3. Feature Inventory

The E2E test suite spans six core functional areas of acAIcia:

| Feature ID | Feature Name | Description | Key API Endpoints & State Rules |
|------------|--------------|-------------|---------------------------------|
| **F1** | **Auth & User Sessions** | Guest access vs Authenticated Researcher mode, login/logout, query limits, RBAC roles. | `/auth_login` simulation, guest session tracking (`guest_query_count <= 20`), `user_id` / `email` role assignment (`admin` vs `researcher`). |
| **F2** | **RAG Chat Interface** | Dynamic prompt pills, asynchronous query execution, polling, citation parsing, source cards. | `GET /prompt_pills`, `POST /query`, `GET /query/status/{query_id}`, inline `[Author, Year]` citations, DOI links. |
| **F3** | **Settings & Customization** | Global LLM provider selection (Modal Gemma 4, Gemini 2.5, NVIDIA NIM, DeepSeek Reasoner) & user custom instructions editor. | `GET /settings`, `POST /settings`, `GET /user/settings`, `POST /user/settings`. |
| **F4** | **Interactive Feedback** | Inline upvote (+1) and downvote (-1) rating buttons with optional text corrections. | `POST /feedback` (`log_id`, `user_id`, `rating`, `correction_text`). |
| **F5** | **Admin Observability** | Live operational metrics dashboard displaying query counts, cache hit rate %, stage latencies, user satisfaction, eval runs. | `GET /admin/metrics` (`total_queries`, `cache_hit_rate_pct`, `p50_latency_ms`, `p95_latency_ms`, `stage_latency_averages`, `user_feedback`, `recent_evaluations`). |
| **F6** | **Informational Views** | Responsive Markdown content views for About acAIcia, FAQs, Research Publications/Blogs, and Contact pages. | Navigation commands `/about`, `/faqs`, `/blogs`, `/contact` and structured markdown rendering. |

---

## 4. 4-Tier Coverage Methodology

The test suite is structured into four distinct tiers, progressing from individual feature coverage to complex multi-step scenarios:

```
+-----------------------------------------------------------------------+
|  Tier 4: Real-World Scenarios (End-to-End Researcher Workflows)       |
+-----------------------------------------------------------------------+
|  Tier 3: Cross-Feature Pairwise Combinations                          |
+-----------------------------------------------------------------------+
|  Tier 2: Boundary & Corner Cases (>=5 tests per feature = 30 tests)   |
+-----------------------------------------------------------------------+
|  Tier 1: Feature Coverage (>=5 tests per feature = 30 tests)          |
+-----------------------------------------------------------------------+
```

### Tier 1: Feature Coverage (>= 5 tests per feature, 30+ tests total)
Focuses on happy path validation for all core endpoints and features across Auth, Chat, Settings, Feedback, Admin, and Info views.
- **Auth (5 tests)**: Guest session initialization, researcher login success, admin login success, logout action, user identity persistence.
- **Chat (5 tests)**: Dynamic prompt pills retrieval, query submission, status polling completion, `[Author, Year]` citation formatting, source chunk card metadata.
- **Settings (5 tests)**: GET global settings, POST global settings update, GET user profile, POST user custom instructions, default user profile fallback.
- **Feedback (5 tests)**: Submit positive feedback (+1), submit negative feedback (-1), feedback with correction text, anonymous feedback, authenticated feedback.
- **Admin (5 tests)**: Metrics response structure, stage latency averages breakdown, user feedback statistics, recent evaluations list, cache hit rate percentage calculation.
- **Info Views (5 tests)**: About section content, FAQs section content, Publications/Blogs section content, Contact section content, Markdown structure formatting.

### Tier 2: Boundary & Corner Cases (>= 5 tests per feature, 30+ tests total)
Focuses on edge cases, invalid inputs, system limits, and error handling.
- **Auth (5 tests)**: 20-query limit enforcement for guests, guest provider locking to Modal Gemma 4, invalid login password handling, malformed email address rejection, empty login payload error.
- **Chat (5 tests)**: Empty query string validation, Guardian guardrail rejection for off-topic queries, nonexistent `query_id` status lookup (404), oversized query payload handling, malformed conversation history payload.
- **Settings (5 tests)**: Invalid LLM provider name rejection (400), guest attempt to select restricted provider, clearing custom instructions with empty string, 5000+ character custom instructions handling, missing `user_id` query parameter handling.
- **Feedback (5 tests)**: Invalid rating value rejection (e.g. 0 or 5), missing `log_id` validation error (422), empty JSON payload rejection, oversized correction text handling, duplicate feedback submissions for same query log.
- **Admin (5 tests)**: Unauthorized user access control, zero queries edge case handling (0% division protection), P50/P95 latency boundary verification, 100% negative feedback satisfaction rate calculation, empty evaluation runs list handling.
- **Info Views (5 tests)**: Unknown info section fallback, Markdown HTML sanitization, DOI URL format verification (`https://doi.org/...`), empty search filter on FAQs, section navigation history state.

### Tier 3: Cross-Feature Combinations (6 Pairwise Feature Tests)
Focuses on interactions between distinct features to catch integration bugs.
1. **Auth + Settings**: Researcher authentication unlocks restricted LLM provider selection (`gemini`, `nvidia`, `deepseek`).
2. **Chat + Feedback + Admin**: Submitting a query, polling completion, submitting upvote feedback, and verifying that the admin metrics upvote count updates dynamically.
3. **Settings + Chat Synthesis**: Setting custom research instructions in User Settings and verifying they are injected into the Synthesis Agent prompt context during RAG query execution.
4. **Guest Auth + Chat Limit Enforcement**: Submitting 20 guest queries and verifying that the 21st query is blocked with a guest limit error message until login occurs.
5. **Admin Telemetry + Multi-Agent Pipeline**: Executing a RAG query and confirming stage latencies (`guardian_ms`, `architect_ms`, `retrieval_ms`, `synthesis_ms`) are recorded in telemetry and displayed in Admin Metrics.
6. **Auth + Admin Dashboard (RBAC)**: Ensuring standard researchers are blocked from Admin metrics access while admin accounts (`b.obaga@landscapealliance.org`) gain full metric observability.

### Tier 4: Real-World Application Scenarios (4 Multi-Step Workflows)
Focuses on end-to-end researcher journeys mimicking real user behavior.
1. **Full Researcher Workflow**:
   - Researcher signs in -> sets custom instructions -> chooses Gemini 2.5 provider -> submits research query -> polls status -> verifies response and `[Author, Year]` citations -> submits downvote feedback with correction text -> verifies admin dashboard telemetry update.
2. **Guest-to-Authenticated Upgrade Workflow**:
   - Guest user reaches query limit warning -> signs in as researcher -> query limit removed -> provider choices unlocked -> submits query successfully.
3. **Semantic Cache Hit Workflow**:
   - Initial query executes full multi-agent pipeline (`cache_hit: false`) -> second identical query triggers instant semantic cache hit (`cache_hit: true`, latency < 50ms) -> verifies admin cache hit rate metric increases.
4. **Guardian Domain Guardrail Rejection Workflow**:
   - User inputs off-topic/malicious query -> Guardian agent intercepts and rejects (`FAIL`) -> polite domain boundary message returned without invoking synthesis -> telemetry logs rejection metrics.

---

## 5. Test Execution & Automation Setup

### Test Suite Directory Layout
```
tests/
├── __init__.py
├── mock_server.py                     # Stateful in-memory FastAPI mock engine matching API contracts
├── test_tier1_feature_coverage.py     # Tier 1: 30 happy path feature coverage tests
├── test_tier2_boundary_corner.py       # Tier 2: 30 boundary & corner case tests
├── test_tier3_cross_feature.py          # Tier 3: 6 cross-feature pairwise integration tests
├── test_tier4_real_world_scenarios.py   # Tier 4: 4 end-to-end researcher workflow scenarios
└── run_tests.py                         # Standalone automated test runner and report generator
```

### Execution Commands
Run the complete automated test suite using `.venv/bin/python`:

```bash
# Method 1: Using standalone runner script (Recommended)
.venv/bin/python tests/run_tests.py

# Method 2: Using pytest runner
.venv/bin/python -m pytest tests/ -v
```

### Environment Variables
- `TEST_MODE`: Set to `mock` (default) for in-memory mock engine or `live` for live FastAPI server testing.
- `BACKEND_URL`: URL of the target backend instance when `TEST_MODE=live` (e.g. `http://localhost:8000` or Modal URL).
