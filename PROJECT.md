# Project: acAIcia Frontend Migration

## Architecture
- **Tech Stack**: React 18 + Vite + TypeScript + Tailwind CSS + Lucide Icons SPA located in `frontend/`.
- **Backend API**: Connects to FastAPI backend (`backend/app.py`).
- **Theme & Styling**: Forestry dark green (`#0F291E`), emerald accents (`#10B981`), dark theme, custom glassmorphism, responsive sidebar & header.
- **State Management**: React Context providers (`AuthContext`, `SettingsContext`, `ChatContext`).
- **Core Features**:
  - **Auth & Sessions**: Guest mode (20 max query limit, locked to Modal Gemma 4 provider) vs Authenticated Researcher mode (login/logout modal matching `/auth_login`, role display, unlocked provider selection and custom instructions).
  - **RAG Chat Interface**: Dynamic message history, research prompt pills from `GET /prompt_pills`, real-time message polling status indicator with stage progress, expandable source chunk cards with DOI links and inline `[Author, Year]` citations.
  - **Provider & Customization Settings**: Provider selector (Modal Gemma 4 for guests; Gemini 2.5, NVIDIA Llama 3.3, DeepSeek Reasoner for authenticated researchers), custom instructions editor for synthesis agent (`/user/settings`).
  - **Interactive Feedback**: Upvote/downvote buttons on messages with feedback modal/input for logged corrections submitted to `POST /feedback`.
  - **Admin Observability Dashboard**: `/admin` view with live metrics from `GET /admin/metrics` (total queries, cache hit rate %, P50/P95 latencies, breakdown of stage latencies for Guardian/Architect/Retrieval/Synthesis, user satisfaction %, recent evaluation runs).
  - **Informational Views**: Responsive navigation for Chat, About acAIcia, FAQs, Research Blogs, and Contact views with formatted Markdown rendering.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite Creation | Create opaque-box E2E test infrastructure & Tiers 1-4 test cases (`TEST_INFRA.md`, `TEST_READY.md`) | None | DONE |
| 2 | React Workspace & API Client | Initialize Vite + React + TS + Tailwind workspace in `frontend/`, write TypeScript interfaces and `src/api/client.ts` | None | DONE |
| 3 | Core State & App Shell Layout | Create AuthContext, SettingsContext, ChatContext, Header, Sidebar, Toast system, and main App layout | M2 | DONE |
| 4 | Chat Interface & Feedback System | Implement RAG Chat, Prompt Pills, Query Polling Status, Source Chunk Cards, Citation Badges, and Feedback Modal | M3 | DONE |
| 5 | Settings & Admin Dashboard | Implement Provider Selector Modal, Custom Instructions Editor, and Admin Observability Metrics Dashboard | M3 | DONE |
| 6 | Informational Views & Navigation | Implement Markdown rendering views for About, FAQs, Blogs, Contact pages | M3 | DONE |
| 7 | Integration, E2E Pass & Hardening | Pass 100% E2E test suite (Tiers 1-4) & Adversarial Coverage Hardening (Tier 5) | M1, M4, M5, M6 | DONE |

## Interface Contracts
### React Frontend ↔ FastAPI Backend
- `GET /prompt_pills` -> `{ "pills": string[] }`
- `GET /settings` -> `SettingsResponse`: `{ "llm_provider": string, "google_api_key_configured": boolean, "nvidia_api_key_configured": boolean, "deepseek_api_key_configured": boolean, "hf_token_configured": boolean, "active_source": string }`
- `POST /settings` -> Body: `{ "llm_provider": string }` -> `SettingsResponse`
- `GET /user/settings?user_id=...` -> `UserProfile`
- `POST /user/settings` -> Body: `UserProfileRequest` -> `{ "status": "success", "profile": UserProfile }`
- `POST /feedback` -> Body: `{ "log_id": string, "user_id"?: string, "rating": 1 | -1, "correction_text"?: string }` -> `{ "status": "success" }`
- `GET /admin/metrics` -> `AdminMetricsResponse`: `{ "total_queries": number, "cache_hit_rate_pct": number, "guardian_pass_rate_pct": number, "p50_latency_ms": number, "p95_latency_ms": number, "stage_latency_averages": { "guardian_ms": number, "architect_ms": number, "retrieval_ms": number, "synthesis_ms": number }, "user_feedback": { "upvotes": number, "downvotes": number, "satisfaction_pct": number }, "recent_evaluations": Array<{ "timestamp": string, "faithfulness_score": number, "answer_relevance_score": number, "context_recall_score": number, "passed": boolean }> }`
- `POST /query` -> Body: `{ "query": string, "session_id"?: string, "user_id"?: string, "conversation_history"?: Array<{ "role": string, "content": string }> }` -> `{ "query_id": string, "status": "processing" }`
- `GET /query/status/{query_id}` -> Response: `{ "status": "processing" | "completed" | "failed", "response"?: string, "sources"?: Array<{ "title": string, "authors": string, "year": number, "url": string, "doi": string }>, "cache_hit"?: boolean, "error"?: string }`

## Code Layout
```
frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   └── client.ts
│   ├── types/
│   │   └── index.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   ├── SettingsContext.tsx
│   │   └── ChatContext.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── chat/
│   │   │   ├── ChatArea.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── PromptPills.tsx
│   │   │   ├── SourceCard.tsx
│   │   │   ├── CitationBadge.tsx
│   │   │   └── StatusIndicator.tsx
│   │   ├── feedback/
│   │   │   ├── FeedbackModal.tsx
│   │   │   └── RatingButtons.tsx
│   │   ├── settings/
│   │   │   ├── SettingsModal.tsx
│   │   │   └── CustomInstructionsEditor.tsx
│   │   ├── auth/
│   │   │   ├── LoginModal.tsx
│   │   │   └── UserBadge.tsx
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── MetricCard.tsx
│   │   │   └── LatencyBreakdown.tsx
│   │   ├── info/
│   │   │   └── InfoView.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       ├── Skeleton.tsx
│   │       └── Toast.tsx
│   ├── pages/
│   │   ├── ChatPage.tsx
│   │   ├── AdminPage.tsx
│   │   └── InfoPage.tsx
│   └── styles/
│       └── globals.css
```
