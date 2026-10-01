# Frontend Architecture & Interactive Guides

[← Back to README](../README.md)

The acAIcia frontend is a modern **Vite 5 + React 18 + TypeScript + React Router 6 + Tailwind CSS** application (`frontend/`), customized with the Landscape Alliance design system (`#f0f7f2` botanical canvas, `#0f1026` deep plum primary, `#0fa8a6` teal accent).

---

## 🏛️ Component & Context Structure

- **Context Providers (`frontend/src/context/`)**:
  - `AuthContext`: Generates machine UUID (`acaicia_machine_id`) used as `guest_session_id` in API calls.
  - `ChatContext`: Manages chat messages, research prompt pills, RAG status stage polling, feedback modal state, and multi-session chat history stored in `localStorage`. Includes consecutive error tracking (aborts only after 10 consecutive network failures), 180-second polling timeout limit, dynamic backend stage updates, and auto-resume polling for pending queries on session mount or switch.
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

## 🔗 Citation Display Architecture

### Dual Rendering System
acAIcia renders citation information through two separate, parallel systems:

1. **Inline Citations (Answer Body)**: The LLM generates `[Author(s), Year]` citations within the synthesized answer text (e.g., `[Hoang et al., 2010]`). These are rendered as plain text within Markdown paragraphs by the `markdown-to-jsx` library in [`MessageItem.tsx`](../frontend/src/components/chat/MessageItem.tsx). They are **not** interactive — they do not link to the Source Cards below or render as clickable elements.

2. **Source Cards (Retrieved Sources Section)**: Below each assistant response, a collapsible "Retrieved Peer-Reviewed Sources" section displays interactive cards ([`SourceCard.tsx`](../frontend/src/components/chat/SourceCard.tsx)) for each source returned by the retrieval pipeline. Each card shows the publication title, authors, year, and a DOI link button. An expandable "Show Chunk Preview" drawer displays the relevant text excerpt.

### Source-to-Citation Alignment
The `sources` array is constructed from retrieval results **before** synthesis, meaning:
- All 5 reranked sources appear as Source Cards regardless of whether the LLM cited them.
- The LLM may cite only 2–3 of the 5 sources if the others are less relevant to the specific query angle.
- There is currently no visual distinction between sources that were cited inline and sources that were merely retrieved.

> **Implemented Solution (Issue #21)**: "Cited" / "Retrieved" badges have been added to Source Cards to visually indicate whether a source's author/year appears in the synthesized answer text. This is driven by the backend's `cited` flag on the source object, with a client-side regex fallback in `MessageItem.tsx`.

### Streaming Source Delivery
In SSE streaming mode, the backend emits a `sources` event **before** synthesis begins ([`pipeline.py:1231`](../backend/pipeline.py)). This allows the frontend to render Source Cards immediately while answer tokens stream below. The sources array is attached to the assistant message via `ChatContext.tsx` as soon as the `sources` event arrives.

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

Administrators can access the comprehensive 5-tab analytics dashboard at `/admin`. **Access is gated** — the page requires the `ADMIN_API_KEY` before rendering any content (the key is verified against the backend, then stored in `localStorage` as `acaicia_admin_key`).
- **Global Model Selection**: Switch the active LLM provider (Mistral Small 4 — default, Gemini 2.5 Flash, NVIDIA Llama 3.3, DeepSeek Reasoner) for all acAIcia user queries.
- **Global Filter Bar**: Date range selector (Today, 7d, 30d, 90d, Custom), Topic dropdown, LLM Provider selector, Query Type filter, and Time-of-Day hour range selector (0-23 UTC).
- **5 Analytics Tabs**:
  1. **📊 Overview**: KPI cards, Chart.js daily query volume line chart, provider distribution doughnut, and system health alerts.
  2. **💰 Cost & Usage**: Estimated USD cost breakdown, token statistics (input/output split), daily cost trend bar chart, provider rate reference cards, and paginated **Per-User Cost Breakdown Table**.
  3. **🧠 Query Intelligence**: Topic taxonomy distribution horizontal bar chart, query type breakdown, and **Popular Documents Table** (most-retrieved publications with RRF scores).
  4. **⚡ Performance**: Latency percentiles (P50, P95, P99), latency trend chart, 4-stage pipeline timing breakdown, **7×24 Time-of-Day Activity Heatmap**, and **Semantic Cache Management** (stats + cache clear action).
  5. **📋 Evaluations**: RAGAS quality score cards (Faithfulness, Answer Relevance, Context Precision), production RAGAS scores table, paginated evaluation benchmark runs, feedback log with sentiment filter, and unresolved system alerts.
- **CSV Export**: Click **Export CSV** to stream full interaction logs for funder reporting.
- **Security**: The `/admin` route requires the `ADMIN_API_KEY` before rendering (enter it in the lock screen). It is stored in `localStorage` as `acaicia_admin_key` and sent as `Authorization: Bearer <key>` on all `/admin/*` requests.
