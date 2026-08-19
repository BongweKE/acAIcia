# Frontend Architecture & Interactive Guides

[← Back to README](../README.md)

The acAIcia frontend is built using **Chainlit** (`frontend/app.py`), customized with a forest dark-mode theme (`#06170d` background, `#0e2b1b` cards, `#00e65c` emerald highlights) matching CIFOR-ICRAF branding.

---

## User Settings & Profile Customization Guide

Users can view and configure custom research instructions that get automatically injected into Synthesis prompts across chats.

### Commands & Controls
- **View Settings:** Type `/settings` in the chat composer to open the User Settings & Profile panel.
- **Set Custom Research Instructions:** Type `/set_instructions [your custom instruction here]` in the chat.
  - *Example:* `/set_instructions Focus on agroforestry policy briefs and quantitative metrics in East Africa.`
- **Backend Integration:** Active instructions are saved to `user_profiles` table via `/user/settings` API and automatically applied to Synthesis prompts.

---

## In-Chat Response Feedback Guide

Every synthesized answer card includes interactive action buttons:
- **`👍 Useful` (Upvote):** Logs a positive rating (+1) for the response in `query_feedback`.
- **`👎 Needs Work` (Downvote):** Logs a negative rating (-1) for quality analysis and evaluation.

---

## Admin Observability Dashboard Guide

Administrators can access real-time system performance and RAG metrics directly in the chat interface:
- **Command:** Type `/admin` in the chat composer.
- **Metrics Displayed:**
  - Total queries processed & Cache Hit Rate %.
  - p95 End-to-End Latency.
  - User Satisfaction % (+1 / -1 ratio).
  - Per-stage latency breakdown bars (Guardian, Architect, Hybrid Retrieval, Synthesis).
  - Historical RAG evaluation benchmark run results (`evaluation_runs`).

---

## Visual Styling
Custom CSS is configured in `frontend/public/style.css`. Key style components include:
- `.acaicia-welcome-card`: Forest gradient card with logo SVG.
- `.acaicia-settings-card`: Dark emerald profile settings container.
- `.acaicia-feedback-actions` & `.acaicia-feedback-btn`: Styled upvote/downvote buttons.
- `.acaicia-admin-container` & `.acaicia-latency-bar`: Observability dashboard cards and latency tracks.
