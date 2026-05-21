# Frontend Architecture

[← Back to README](../README.md)

acAIcia's frontend is a minimalist application built with **Streamlit** (`frontend/app.py`). It emphasizes an elegant layout while serving as the remote client for the complex logic executing asynchronously on the Modal backend.

## Key Features

1. **Statefulness**
   The application holds onto chat histories locally via `st.session_state`. This ensures an unbroken back-and-forth flow visually without needing to maintain persistent WebSockets or polling hooks.

2. **Dynamic UI/Citations**
   A standout feature is the structured mapping of citations. When the Python backend returns the `sources` metadata in combination with the Generative AI `answer`, the UI parses the array, instantiating `st.expander` modules below the assistant's answer. This securely binds the LLM's response to the actual literature, highlighting DOI and URL links when available.

3. **Admin Control Console Sidebar**
   The Streamlit app features a sidebar console (`st.sidebar`) that interfaces with the backend `/settings` API:
   - **Provider Switching:** Allows administrators to select the active model provider (`gemini`, `nvidia`, or `modal`) and save it.
   - **Credential Status Monitoring:** Evaluates and displays configuration health (e.g., whether Google, NVIDIA, or Hugging Face tokens are active) and lists the source of the settings (`volume`, `env`, or `default`).
   - **Settings Caching:** Fetches backend configuration and caches the values for 10 seconds (`@st.cache_data(ttl=10)`) to maintain high performance and prevent database/volume overloading. Selecting "Apply & Save Settings" explicitly clears the cache and reruns the session.

4. **Zero Business Logic**
   The Streamlit app acts exclusively as a dumb client. All reasoning, token tracking, embedding models, query rejection, and database connections happen purely inside the Backend FastAPI endpoint (pointed to by the `BACKEND_URL` constant in `frontend/app.py`).

## Flow
- Upon load, the frontend hits the settings endpoint `GET /settings` (derived by rewriting the `BACKEND_URL` suffix to `/settings`).
- The user provides an input prompt via `st.chat_input`.
- The frontend shoots off a blocking REST `POST` request to `BACKEND_URL` with a 60-second timeout to accommodate Generative AI latency.
- Upon receiving a JSON containing `"response"` and `"sources"`, the app writes them dynamically into markdown slots.

