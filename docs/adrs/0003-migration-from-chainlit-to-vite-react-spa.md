# ADR 0003: Migration from Chainlit UI to Vite + React 18 SPA Frontend

- **Status**: Approved & Implemented
- **Date**: 2026-08-15
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

The initial acAIcia prototype used Chainlit as a rapid Python-centric chat UI. As the project evolved into an end-to-end evidence synthesis system for Landscape Alliance researchers, Chainlit's UI layout, customization limits, and lack of web landing pages created significant friction for brand integration, complex client-side routing, interactive citation feedback overlays, and admin observability dashboards.

---

## 2. Decision Drivers

1. **Brand & Custom UI Freedom**: Need full control over CSS design tokens, HSL botanical color palette, custom Acacia wordmark SVG, and responsive page layouts.
2. **Multi-Page Information Architecture**: Need dedicated site routes (`/`, `/assistant`, `/how-it-works`, `/about`, `/feedback`, `/admin`).
3. **Client-Side State Management**: Support for persistent multi-session chat histories (`localStorage`), custom profile instructions, and admin LLM model governance without relying on Chainlit server actions.
4. **Performance & Scalability**: Fast SPA bundle compilation via Vite 5, React 18, and TypeScript 5.

---

## 3. Decision Outcome

Migrate the frontend from Chainlit to a standalone **Vite + React 18 SPA**:
* Built custom React components (`Header`, `Footer`, `Sidebar`, `ChatMessage`, `SourceCard`, `CitationFeedbackModal`, `AdminDashboard`).
* Configured React Router 6 for client-side routing.
* Connected to the FastAPI Modal backend via clean HTTP/2 REST API client (`src/api/client.ts`).
* Deployed the built static assets on Railway (`https://acaicia.org`) and Modal Cloud backup (`https://ciforicraf-ai--acaicia-frontend-fastapi-app-entrypoint.modal.run`).

---

## 4. Consequences

* **Positive**:
  * Complete UI customizability matching Landscape Alliance brand guidelines.
  * Instant page transitions and modular React component architecture.
  * Native support for interactive admin charts, user feedback modals, and custom markdown citation rendering.
* **Negative**:
  * Required replacing Chainlit websocket event loops with REST polling/status endpoints (`/query` and `/query/status/{query_id}`).
