# Frontend Architecture & Interactive Guides

[← Back to README](../README.md)

The acAIcia frontend is a modern **Vite + React 18 + TypeScript + Tailwind CSS** application (`frontend/`), customized with a forestry dark-mode theme (`#0F291E` background, emerald glassmorphism cards, `#10B981` accents) matching Landscape Alliance branding.

---

## 🏛️ Component & Context Structure

- **Context Providers (`frontend/src/context/`)**:
  - `AuthContext`: Manages user authentication, role assignment (`guest`, `researcher`, `admin`), login modal state, and guest 20-query limit.
  - `ChatContext`: Manages chat messages, research prompt pills, RAG status stage polling, feedback modal state, and persistent multi-session chat history stored in `localStorage`.
  - `SettingsContext`: Handles LLM provider selection (Modal Gemma 4 for guests; Gemini 2.5 Flash, NVIDIA Llama 3.3 70B, DeepSeek Reasoner for researchers) and custom instructions.
  - `ToastContext`: Provides global UI notification toasts.
- **Pages (`frontend/src/pages/`)**:
  - `ChatPage`: Main RAG research chat interface with prompt pills, stage progress indicators, source cards with DOIs, and inline `[Author, Year]` citations.
  - `AdminPage`: Administrator observability dashboard with telemetry, P50/P95 latencies, stage timing breakdowns, user satisfaction metrics, and evaluation benchmark tables.
  - `InfoPage`: Dedicated views for About acAIcia, FAQs, Research Blogs, and Contact details.

---

## 💬 Multi-Session Chat & User Customization Guide

### 1. Multi-Session Management
- **`+ New Research Chat` Button**: Click in the sidebar to start a new chat session with a fresh `session_id`.
- **Recent Chats List**: Access and switch between past chat sessions directly in the sidebar. Sessions persist across browser reloads via `localStorage`.

### 2. User Settings & Custom Synthesis Instructions
- Click **Settings** in the header or user profile panel.
- **Provider Selector**: Authenticated researchers can choose between Gemini 2.5 Flash, NVIDIA Llama 3.3, and DeepSeek Reasoner.
- **Custom Synthesis Instructions**: Save custom preferences (e.g., *"Focus on East Africa agroforestry policy briefs and quantitative metrics"*), automatically applied to Synthesis prompts via `POST /user/settings`.

---

## 👍 In-Chat Response Feedback Guide

Every synthesized response includes interactive feedback actions:
- **`👍` Upvote**: Submits a positive rating (+1) to `POST /feedback`.
- **`👎` Downvote**: Opens a correction modal to log negative ratings and text feedback to `POST /feedback` for evaluation.

---

## 📊 Admin Observability Dashboard Guide

Administrators (`role === 'admin'`) can access real-time system performance and telemetry:
- **Navigation**: Click **Admin Dashboard** in the sidebar navigation or visit `/admin`.
- **Metrics Displayed**: Total queries, cache hit %, P50/P95 latency, stage latency breakdown (Guardian, Architect, Retrieval, Synthesis), user satisfaction ratio, and historical RAG evaluation runs.
