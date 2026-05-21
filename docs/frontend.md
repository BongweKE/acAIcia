# Frontend Architecture

[← Back to README](../README.md)

acAIcia's frontend is a polished, highly responsive application built with **Chainlit** (`frontend/app.py`). It utilizes WebSocket communication and a custom-styled modern UI to interact with the multi-agent backend running asynchronously on Modal.

## Key Features

1. **Forestry & Agroforestry Aesthetic**
   The interface is customized via a custom CSS file (`frontend/public/style.css`) and config (`frontend/.chainlit/config.toml`). It features Outfit typography, smooth animations, and a rich dark/light forestry theme with custom cards for bibliographies and citations.

2. **Visual Step Execution (Asynchronous Polling)**
   Chainlit's native `cl.Step` UI element is used to provide real-time visual progress of the backend pipeline. When a user submits a query, the frontend initiates an asynchronous job on the backend and polls the status endpoint, updating the step spinner in real-time with elapsed execution time.

3. **Rich HTML Citation Blocks**
   When the backend returns the synthesis response and literature sources, the frontend dynamically compiles and formats a curated bibliography card using structured HTML under the response content, highlighting clickable DOI links and reference URLs.

4. **Zero Administrative Footprint in UI (Security-First)**
   The administrative settings panel has been removed from the frontend UI. This prevents unauthorized users from altering LLM providers or viewing credential states. Configuration management is strictly offloaded to the local command-line administration tool (`cli_admin.py`).

5. **Zero Business Logic**
   The frontend operates exclusively as a presentation client. All semantic embeddings, vector database searches, LLM routing (Gemini, NVIDIA, or self-hosted Gemma 4), query safety guards, and synthesis reasoning are offloaded to the Modal FastAPI backend.

## Flow
- **Startup:** The frontend calls the backend `GET /settings` API (derived from `BACKEND_URL`) to fetch and display the active model provider in the chatbot welcome message.
- **Message Submission:** The user submits a prompt, which triggers `POST /query` on the backend. The backend starts the task asynchronously and returns a `query_id`.
- **Pipeline Progress:** The frontend starts a Chainlit execution step and polls the backend status endpoint `GET /query/status/{query_id}` every 2 seconds.
- **Completion:** Once completed, the frontend retrieves the response text and sources, constructs the citation cards, and sends the compiled message back to the chat room.


