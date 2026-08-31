# Frontend Architecture & Interactive Guides

[← Back to README](../README.md)

The acAIcia frontend is a modern **Vite 5 + React 18 + TypeScript + React Router 6 + Tailwind CSS** application (`frontend/`), customized with the Landscape Alliance design system (`#f0f7f2` botanical canvas, `#0f1026` deep plum primary, `#0fa8a6` teal accent).

---

## 🏛️ Component & Context Structure

- **Context Providers (`frontend/src/context/`)**:
  - `AuthContext`: Generates machine UUID (`acaicia_machine_id`) used as `guest_session_id` in API calls.
  - `ChatContext`: Manages chat messages, research prompt pills, RAG status stage polling, feedback modal state, and multi-session chat history stored in `localStorage`.
  - `SettingsContext`: Fetches and displays active LLM model provider in read-only mode for user views, and manages custom synthesis instructions.
  - `ToastContext`: Provides global UI notification toasts.
- **Pages (`frontend/src/pages/`)**:
  - `HomePage`: Scrollable landing page matching design mockup (Hero + Assistant Card, Answer Preview, How it Works, About).
  - `AssistantPage`: Dedicated RAG research chat interface with prompt pills, stage progress indicators, source cards with DOIs, and inline `[Author, Year]` citations.
  - `HowItWorksPage`: Architectural pipeline breakdown (Guardian, Architect, Hybrid Retrieval, Synthesis Engine) and scientific citation protocol.
  - `AboutPage`: Mission and Landscape Alliance background.
  - `FeedbackPage`: Dedicated citation feedback and correction submission page.
  - `AdminPage`: Administrator observability dashboard with telemetry, P50/P95 latencies, stage timing breakdowns, user satisfaction metrics, evaluation benchmark tables, and global LLM model selection.

---

## 💬 Multi-Session Chat & User Customization Guide

### 1. Multi-Session Management
- **Chat Sessions**: Sessions persist across browser reloads via `localStorage`. Each session maintains multi-turn conversation memory (`conversation_history`).

### 2. User Settings & Custom Synthesis Instructions
- Click **Settings** in the header.
- **Custom Synthesis Instructions**: Save custom preferences (e.g., *"Focus on East Africa agroforestry policy briefs and quantitative metrics"*), automatically applied to Synthesis prompts.

---

## 👍 In-Chat Response Feedback Guide

Every synthesized response includes interactive feedback actions:
- **`👍` Upvote**: Submits a positive rating (+1) to `POST /feedback`.
- **`👎` Downvote**: Opens a correction modal to log negative ratings and text feedback to `POST /feedback` for evaluation.

---

## 📊 Admin Observability & Analytics Dashboard Guide

Administrators can access the comprehensive 5-tab analytics dashboard at `/admin`:
- **Global Model Selection**: Switch the active LLM provider (Gemini 2.5 Flash, Modal Gemma 4, NVIDIA Llama 3.3, DeepSeek Reasoner) for all acAIcia user queries.
- **Global Filter Bar**: Date range selector (Today, 7d, 30d, 90d, Custom), Topic dropdown, LLM Provider selector, Query Type filter, and Time-of-Day hour range selector (0-23 UTC).
- **5 Analytics Tabs**:
  1. **📊 Overview**: KPI cards, Chart.js daily query volume line chart, provider distribution doughnut, and system health alerts.
  2. **💰 Cost & Usage**: Estimated USD cost breakdown, token statistics (input/output split), daily cost trend bar chart, provider rate reference cards, and paginated **Per-User Cost Breakdown Table**.
  3. **🧠 Query Intelligence**: Topic taxonomy distribution horizontal bar chart, query type breakdown, and **Popular Documents Table** (most-retrieved publications with RRF scores).
  4. **⚡ Performance**: Latency percentiles (P50, P95, P99), latency trend chart, 4-stage pipeline timing breakdown, **7×24 Time-of-Day Activity Heatmap**, and **Semantic Cache Management** (stats + cache clear action).
  5. **📋 Evaluations**: RAGAS quality score cards (Faithfulness, Answer Relevance, Context Precision), production RAGAS scores table, paginated evaluation benchmark runs, feedback log with sentiment filter, and unresolved system alerts.
- **CSV Export**: Click **Export CSV** to stream full interaction logs for funder reporting.
- **Security**: Key icon (🔑) allows setting an optional `ADMIN_API_KEY` stored in `localStorage` as `acaicia_admin_key`.
