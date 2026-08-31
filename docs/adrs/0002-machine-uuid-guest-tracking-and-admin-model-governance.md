# ADR 0002: Machine UUID Guest Tracking & Admin Model Governance

- **Status**: Approved & Implemented
- **Date**: 2026-08-31
- **Deciders**: Landscape Alliance Engineering Team

---

## 1. Context & Problem Statement

User authentication and login modals introduced friction during preliminary researcher testing. Furthermore, user-selectable LLM models caused unpredictable cost spikes and inconsistent synthesis results.

---

## 2. Decision Drivers

1. **Testing Friction Reduction**: Remove user login requirements during testing while keeping track of user sessions via unique machine IDs.
2. **Model Quality & Cost Control**: Centralize LLM provider selection so administrators govern the active system model (e.g. Gemini 2.5 Flash, Modal Gemma 4, NVIDIA Llama 3.3, DeepSeek Reasoner).
3. **API Contract Stability**: Ensure `guest_session_id` and `session_id` payload fields remain compatible with backend FastAPI RAG analytics.

---

## 3. Decision Outcome

1. **Machine UUID Tracking**:
   * `AuthContext` generates a persistent UUID (`acaicia_machine_id`) stored in browser `localStorage`.
   * The UUID is passed as `guest_session_id` in all `/query` POST requests.
   * Query count limits are removed for testing phase; limits are deferred to post-testing issues.

2. **Admin Model Governance**:
   * Removed model switcher from user settings modals. User views render a read-only pill: `"Active Model: [Model Name]"`.
   * Added an active model control panel in `AdminPage.tsx` allowing admins to execute `POST /settings` to switch the system-wide active LLM.

---

## 4. Consequences

* **Positive**:
  * Uninterrupted user testing experience without login popups or query lockouts.
  * System administrators maintain strict control over LLM providers and cost telemetry.
  * Full multi-turn session context maintained without single-turn cache collision.
* **Negative**:
  * User-specific custom model selection is deferred until authentication is re-enabled post-testing.
