# Multi-Agent Backend Engine (The Pipeline)

[← Back to README](../README.md)

The core brain of acAIcia is a FastAPI app (`backend/app.py`) hosted on **Modal**. It utilizes a sophisticated 4-step processing pipeline where highly-specialized Google Gemini agents iteratively validate, optimize, and synthesize context pulled from your database. By chaining explicit agents, the application remains incredibly rigorous regarding source attribution.

## Comprehensive Sequence Diagram

The following diagram illustrates every API hop, asynchronous background task, and conditional guardrail branch that handles a single user request.

```mermaid
sequenceDiagram
    autonumber
    
    participant UI as Chainlit UI
    participant BP as Backend API
    participant GA as 🛡️ Guardian Agent (Gemini 2.5 Flash)
    participant AA as 🧠 Architect Agent (Gemini 2.5 Flash)
    participant DB as 🐘 Supabase (pgvector)
    participant SA as 📝 Synthesis Agent (Gemini 2.5 Pro)
    participant Tel as 📊 Telemetry Logger
    
    UI->>BP: POST /query (payload: {query})
    
    %% Step 1: The Guardian Agent Pipeline
    Note over BP, GA: Initialize telemetry & token tracking
    BP->>GA: Evaluate input for academic/domain relevance
    GA-->>BP: Return evaluation (PASS or FAIL)
    
    alt FAIL Branch (Malicious or Off-topic)
        BP-->>UI: Return rejection (e.g. "Can only assist with forestry...")
        BP-)Tel: Trigger Async Background Telemetry
        Note over Tel, DB: Log token count, latency, and rejection status
        Tel-)DB: Insert trace into `query_interaction_logs`
    else PASS Branch (Valid Scientific Query)
        
        %% Step 2: The Architect Agent Pipeline
        BP->>AA: Convert conversational query into search string
        AA-->>BP: Return optimized search keywords
        
        %% Step 3: Local Vectorization & Retrieval
        Note over BP, DB: Local Container operations (No external API here)
        BP->>BP: Encode keywords locally via BAAI/bge-base-en-v1.5
        BP->>DB: Execute RPC 'match_documents' (768D Vector, Threshold 0.5)
        
        alt RPC Exception or Latency Failure
            DB-->>BP: Return Error / Empty Array
        else RPC Success
            DB-->>BP: Return Top 5 relevant chunks + relational metadata
        end
        
        %% Step 4: The Synthesis Node Workflow
        alt Hits Found (DB matched documents)
            Note over BP, SA: Compile `context_text` payload with Document metadata
            BP->>SA: Prompt: Answer query citing provided context blocks
        else No Hits Found
            Note over BP, SA: Revert to Fallback Prompt parameters
            BP->>SA: Prompt: Answer using broad scientific training data + explicit warning
        end
        
        SA-->>BP: Synthesized Output text + formatted sources array
        
        %% Response & Telemetry Fulfillment
        BP-->>UI: Return JSON Payload (Answer + Sources Array)
        BP-)Tel: Trigger Async Background Telemetry
        Note over Tel, DB: Async capture of end-to-end latency & source IDs
        Tel-)DB: Insert finalized trace into `query_interaction_logs`
    end
```

## Exploring the Agents & Fallbacks

1. **Guardian Agent (Gemini 2.5 Flash)**
   The fastest and cheapest interceptor. If a user asks about political opinions or general recipes, the Guardian immediately branches into the **FAIL path**, protecting the entire system from wasting expensive context tokens downstream. It guarantees interactions remain strictly within the CIFOR-ICRAF mandate (maintained for LLM context compatibility).

2. **Architect Agent (Gemini 2.5 Flash)**
   Conversational inputs naturally make terrible search queries. Passing the safeguard, the architect strips stop-words and reformulates intents to maximize semantic density. This ensures the string sent to the local `sentence-transformers` library produces a vector highly aligned for cosine-similarity matching against the chunks in the database.

3. **Supabase pgvector Retrieval RPC**
   The backend translates the Architect's keywords locally using `BAAI/bge-base-en-v1.5` and fires the 768-D array to Supabase. Supabase performs the mathematical matching algorithm under the hood, natively resolving structural metadata (Titles, Authors) alongside the semantic chunks.

4. **Synthesis Agent (Gemini 2.5 Pro)**
   The powerhouse node. The Synthesis Agent receives two distinct prompts based on the results from Supabase:
   * **The Citation Prompt:** If vectors match, it instructs the agent to answer with rigorous inline citations `[Author, Year]`, ignoring any chunk information that contradicts the query.
   * **The Fallback Prompt:** If no internal knowledge is retrieved, the agent uses its baseline scientific training to attempt an answer, but its system prompt mandates it warn the user that the knowledge is unsupported by the internal Landscape Alliance knowledge base.

## Non-Blocking Asynchronous Telemetry

To measure API performance, track latency bottlenecks, and account for API token usage securely, the FastAPI backend passes a telemetry dictionary through every node step. 

Crucially, rather than making the user wait for logging to finish, the Backend returns its payload to the Chainlit UI immediately, while utilizing FastAPI's `BackgroundTasks` to invisibly flush the telemetry array into Supabase's `query_interaction_logs` database table.

---

## 5. Dynamic LLM Provider Routing

acAIcia supports four distinct Large Language Model (LLM) backend providers. The active provider is resolved dynamically on each query.

### A. Provider Resolution Logic
When handling a query or settings request, the backend determines the active provider by checking configurations in the following order of precedence:
1. **Persistent Volume Storage:** Reads `/data/settings.json` on the Modal persistent volume `acaicia-data-volume`. If a valid `llm_provider` exists (i.e. `gemini`, `nvidia`, `modal`, or `deepseek`), it takes precedence.
2. **Environment Variable:** Checks `LLM_PROVIDER` in Modal secrets or the local environment.
3. **Legacy Flags:** Falls back to checking `USE_NVIDIA="true"` to trigger the NVIDIA provider, or defaults to `gemini` if no keys are found.

### B. Supported Providers & Models

| Provider | Agent Type | Active Model | Notes / Key Configs |
| :--- | :--- | :--- | :--- |
| **Google Gemini API** | Guardian / Architect / Synthesis | `gemini-2.5-flash` | Requires `GOOGLE_API_KEY`<br>Used as a fallback to prevent quota limits |
| **NVIDIA NIM API** | Guardian / Architect<br>Synthesis | `meta/llama-3.1-8b-instruct`<br>`meta/llama-3.3-70b-instruct` | Requires `NVIDIA_API_KEY`<br>Temperature: 0.20, Top-p: 0.70 |
| **Modal Gemma 4** *(Default)* | Guardian / Architect / Synthesis | `google/gemma-4-E2B-it` | Default active provider<br>Requires `HF_TOKEN` (for gated access)<br>Runs on L4 GPU serverless instance<br>Uses recommended sampling: Temp 1.0, Top-p 0.95, Top-k 64 |
| **DeepSeek API** | Guardian / Architect<br>Synthesis | `deepseek-chat`<br>`deepseek-reasoner` | Requires `DEEPSEEK_API_KEY`<br>OpenAI-compatible endpoint<br>Temperature: 0.20, Top-p: 0.70 |

### C. Self-Hosted Gemma 4 Inference Service
The self-hosted Gemma 4 service is defined in `backend/gemma_inference.py` as an independent Modal App (`acaicia-gemma-inference`).
- **Hardware:** Runs on an NVIDIA L4 GPU (`gpu="L4"`) in `bfloat16` precision to balance speed and accuracy.
- **Model Access:** Downloads `google/gemma-4-E2B-it` from Hugging Face, requiring a valid Hugging Face API token (`HF_TOKEN`) configured in the `acaicia-llm-secrets` Modal Secret.
- **Interface & Communication:** Exposes a `@modal.method()` called `generate(...)` that accepts parameters such as `prompt`, `temperature`, `top_p`, `top_k`, and `max_tokens`. The main backend calls this method using:
  ```python
  gemma_func = modal.Function.from_name("acaicia-gemma-inference", "GemmaModel.generate")
  text = gemma_func.remote(prompt=prompt, temperature=1.0, top_p=0.95, top_k=64, max_tokens=max_tokens)
  ```
- **Special Optimizations:** Disables `<|think|>` tokens natively by default, resulting in clean, direct answers suitable for scientific/academic querying.

### D. Settings Management API Endpoints

The FastAPI backend exposes endpoints to manage the active LLM configuration dynamically:

#### 1. `GET /settings`
Fetches current configuration settings.
* **Response Payload Example (`SettingsResponse`):**
  ```json
  {
    "llm_provider": "modal",
    "google_api_key_configured": true,
    "nvidia_api_key_configured": false,
    "deepseek_api_key_configured": false,
    "hf_token_configured": true,
    "active_source": "volume"
  }
  ```
* **Fields:**
  - `llm_provider`: The currently active provider (`gemini` / `nvidia` / `modal` / `deepseek`).
  - `google_api_key_configured`: Boolean indicating whether `GOOGLE_API_KEY` is set.
  - `nvidia_api_key_configured`: Boolean indicating whether `NVIDIA_API_KEY` is set.
  - `deepseek_api_key_configured`: Boolean indicating whether `DEEPSEEK_API_KEY` is set.
  - `hf_token_configured`: Boolean indicating whether `HF_TOKEN` is set.
  - `active_source`: Source of the active provider configuration (`volume` if loaded from persistent settings volume, `env` if loaded from environment, or `default` fallback).

#### 2. `POST /settings`
Updates the active LLM provider.
* **Request Payload Example (`SettingsRequest`):**
  ```json
  {
    "llm_provider": "modal"
  }
  ```
* **Behavior:** Reloads the persistent `acaicia-data-volume`, writes the configuration object `{"llm_provider": "modal"}` to `/data/settings.json`, and commits/flushes the volume changes to ensure persistence across all serverless API instances.

