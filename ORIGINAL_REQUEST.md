# Original User Request

## Initial Request — 2026-08-19T10:07:33Z

Migrate acAIcia's frontend user interface from Chainlit (Python) to a modern, production-grade React application (Vite + React + Tailwind CSS + Lucide icons) that connects seamlessly to the FastAPI backend, preserving all existing feature parity while upgrading UX with responsive layouts, smooth animations, and clear error handling.

Working directory: /home/pro-g/ProG/acAIcia
Integrity mode: development

## Requirements

### R1. Full React Frontend Migration & Feature Parity
Reimplement all existing Chainlit UI features in React:
- **Authentication & User Sessions**: Guest access (guest query limit tracking, 20 queries max), Login/Logout modal (password/email authentication matching `/auth_login`), role display (Guest vs Authenticated Researcher).
- **RAG Chat Interface**: Dynamic message history, research prompt pills, real-time message streaming / polling status, expandable source chunk cards with DOI links and inline `[Author, Year]` citations.
- **Provider & Customization Settings**: Provider selector modal (Modal Gemma 4 for guests; Gemini 2.5, NVIDIA Llama 3.3, DeepSeek Reasoner for authenticated researchers), custom instructions editor for synthesis agent.
- **Interactive Feedback System**: Upvote/downvote buttons on messages with feedback modal/input for logged corrections.
- **Admin Metrics Dashboard**: `/admin` view with key operational metrics (total queries, cache hit rate %, P50/P95 latencies, breakdown of stage latencies for Guardian/Architect/Retrieval/Synthesis, user satisfaction %, and recent evaluation runs).
- **Informational Views & Navigation**: Header/Sidebar navigation for Chat, About acAIcia, FAQs, Research Blogs, and Contact views.

### R2. FastAPI Backend Integration & API Layer
Build a dedicated API client in React to communicate with the FastAPI backend endpoints:
- `GET /prompt_pills`
- `GET /settings` and `POST /settings`
- `GET /user/settings` and `POST /user/settings`
- `POST /feedback`
- `GET /admin/metrics`
- `POST /query` and `GET /query/status/{query_id}` for query polling/streaming

### R3. Modern Design System & Production Aesthetics
Implement a sleek design system:
- **Styling**: Tailwind CSS with custom glassmorphism, tailored color palettes (forestry dark green `#0F291E`, emerald accents, dark theme), modern sans font (Inter/Outfit).
- **Interactivity**: Micro-animations, responsive sidebar, loading skeletons for RAG stages, toast notifications for errors and updates.

## Acceptance Criteria

### Build & Code Verification
- [ ] React frontend builds cleanly without TypeScript or bundler errors (`npm run build`).
- [ ] Clean folder structure under `frontend/src` with separated components, pages, context providers, and API services.

### Feature Parity & Verification
- [ ] Guest session enforces query limit and locks provider to Modal Gemma 4.
- [ ] Authenticated login unlocks provider selection (Gemini, NVIDIA, DeepSeek) and custom instructions.
- [ ] Query submission correctly polls `/query/status/{query_id}` and renders inline citations with source document DOIs.
- [ ] Upvote and downvote actions trigger `/feedback` API requests successfully.
- [ ] Admin view fetches and displays live metrics from `/admin/metrics`.
- [ ] Info tabs (About, FAQs, Blogs, Contact) display formatted Markdown content.
