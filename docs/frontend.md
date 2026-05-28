# Frontend Architecture

[← Back to README](../README.md)

acAIcia's frontend is a polished, highly responsive application built with **Chainlit** (`frontend/app.py`). It utilizes WebSocket communication and a custom-styled modern UI to interact with the multi-agent backend running asynchronously on Modal.

## Key Features

1. **Refactored Welcome Card**
   The landing interface has been streamlined into a clean welcome card displaying the acAIcia logo, application name, and tagline only. A temporary description card provides onboarding context for new users. The full forestry & agroforestry aesthetic is preserved via a custom CSS file (`frontend/public/style.css`) and config (`frontend/.chainlit/config.toml`), featuring Outfit typography, smooth animations, and a rich dark/light forestry theme with custom cards for bibliographies and citations.

2. **Visual Step Execution (Asynchronous Polling)**
   Chainlit's native `cl.Step` UI element is used to provide real-time visual progress of the backend pipeline. When a user submits a query, the frontend initiates an asynchronous job on the backend and polls the status endpoint, updating the step spinner in real-time with elapsed execution time.

3. **Rich HTML Citation Blocks**
   When the backend returns the synthesis response and literature sources, the frontend dynamically compiles and formats a curated bibliography card using structured HTML under the response content, highlighting clickable DOI links and reference URLs.

4. **Credential Dashboard Fully Removed**
   The credential dashboard has been fully removed from the frontend UI. No administrative settings panel, credential states, or provider indicators are exposed to any user. This prevents unauthorized users from altering LLM providers or viewing credential configurations. All configuration management is strictly offloaded to the local command-line administration tool (`cli_admin.py`).

5. **Randomized Thinking Animation Phrases**
   While the backend pipeline processes a query, the frontend displays randomized thinking animation phrases to keep the user engaged. These cycling status messages replace a static spinner, providing a more dynamic and polished user experience during processing.

6. **Zero Business Logic**
   The frontend operates exclusively as a presentation client. All semantic embeddings, vector database searches, LLM routing (Gemini, NVIDIA, DeepSeek, or self-hosted Gemma 4), query safety guards, and synthesis reasoning are offloaded to the Modal FastAPI backend.

## Flow
- **Startup:** The frontend calls the backend `GET /settings` API (derived from `BACKEND_URL`) to fetch the active model provider for internal health checks. Credentials are still fetched on startup for validation purposes but are no longer displayed in the UI.
- **Message Submission:** The user submits a prompt, which triggers `POST /query` on the backend. The backend starts the task asynchronously and returns a `query_id`.
- **Pipeline Progress:** The frontend starts a Chainlit execution step and polls the backend status endpoint `GET /query/status/{query_id}` every 2 seconds. Randomized thinking phrases are displayed during this polling phase.
- **Completion:** Once completed, the frontend retrieves the response text and sources, constructs the citation cards, and sends the compiled message back to the chat room.


