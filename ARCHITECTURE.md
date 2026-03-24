# acAIcia System Architecture

This dedicated document outlines the high-level infrastructure, multi-agent logic flow, and data pipelines powering **acAIcia**, the CIFOR-ICRAF Research Assistant.

## 1. High-Level Operations Overview

acAIcia relies on a fully serverless, highly decoupled ecosystem split between Streamlit Community Cloud (Frontend), Modal Serverless GPU Containers (Backend APIs & Data Ingestion), and Supabase (Postgres & Vector Store).

```mermaid
flowchart TD
    User([fa:fa-user User]) <-->|HTTPS / UI Interactivity| UI[Streamlit Frontend]
    UI <-->|REST API JSON| API[Modal FastAPI Backend]
    API <-->|SQL Client/RPC| DB[(Supabase Postgres DB)]
    API <-->|Gemini Flash/Pro| LLM[Google AI API]
    
    subgraph Data Ingestion Pipeline
        Admin([fa:fa-user-tie Administrator]) -->|CLI: upload.py| Vol[(Modal Cloud Volume)]
        Vol -->|Event Trigger| Worker[Modal GPU Worker]
        Worker -->|SentenceTransformers| LocalEmbed[Local GPU Embeddings]
        LocalEmbed -->|Insert Vectors| DB
    end
```

---

## 2. Multi-Agent Backend Engine (The Pipeline)

The core brain of acAIcia is a FastAPI app hosted on **Modal**. It utilizes a sophisticated 4-step processing pipeline where highly-specialized Google Gemini agents iteratively validate, optimize, and synthesize context pulled from your database.

By chaining explicit agents, the application remains incredibly rigorous regarding source attribution.

```mermaid
sequenceDiagram
    participant UI as Streamlit UI
    participant BP as Backend API
    participant GA as 🛡️ Guardian Agent
    participant AA as 🧠 Architect Agent
    participant DB as 🐘 Supabase (pgvector)
    participant SA as 📝 Synthesis Agent
    participant Tel as 📊 Telemetry Logger
    
    UI->>BP: POST /query (User String)
    
    %% Step 1
    BP->>GA: Is query academically relevant/safe?
    GA-->>BP: YES (Proceed)
    
    %% Step 2
    BP->>AA: Optimize query for vector search
    AA-->>BP: "optimized search keywords"
    
    %% Step 3
    BP->>BP: Encode String via BAAI/bge-base-en-v1.5
    BP->>DB: rpc('match_documents')
    DB-->>BP: Return top 5 most relevant vectors
    
    %% Step 4
    BP->>SA: Evaluate chunks & formulate response
    SA-->>BP: Synthesized Answer + Citations
    
    BP-->>UI: Response Payload to User
    
    %% Asynchronous Telemetry
    BP-)Tel: (Background Task) Log tokens, latency, sources
    Tel-)DB: Insert into `query_interaction_logs`
```

### Components of the Backend Strategy
*   **Guardian Agent** (Gemini 2.5 Flash): The fast interceptor. If a user asks about political opinions or recipes, the Guardian immediately bounces the request, preventing waste of expensive context tokens.
*   **Architect Agent** (Gemini 2.5 Flash): Conversational inputs naturally make terrible search queries. The architect strips stop-words and reformulates intents to maximize semantic density.
*   **Local Query Encoding** (`sentence-transformers`): Replaces external API limits by instantly encoding the optimized query into 768 dimensions locally within the container via HuggingFace models.
*   **Supabase Retrieval**: Performs exact Cosine Similarity calculations physically on the Postgres layer via the `match_documents` RPC.
*   **Synthesis Agent** (Gemini 2.5 Pro): Processes retrieved data blocks critically, ignoring poor matches and compiling academic prose complete with inline `[DocumentTitle, Year]` citations.
*   **Non-Blocking Telemetry**: Telemetry (Latency, Node execution times, Status checks) relies on FastAPI's `BackgroundTasks`, so the UI receives the response natively while analytical data syncs securely downstream.

---

## 3. The GPU Data Ingestion Cloud Engine

To keep embedding costs at practically zero and process massive libraries exceptionally quickly without rate limits, the ingestion framework operates directly on **Modal Volumes and T4/A10G Cloud GPUs**.

```mermaid
flowchart LR
    Docs[PDF, DOCX, MD, PPTX] -->|CLI upload.py| Vol{Modal Cloud Volume \n `/acaicia-data-volume`}
    Metadata[metadata.json] -->|Mapped Variables| Vol
    
    Vol -->|Run| App1[Modal Serverless App]
    
    subgraph Container Operations
    direction TB
    App1 --> Parser[PyMuPDF / docx Parser]
    Parser --> Chunking[LangChain RecursiveSplitter\n(2500 char shards)]
    Chunking --> Model[BAAI/bge-base-en-v1.5 \n HuggingFace GPU Model]
    Model --> Vectors[768 Dimension Arrays]
    end
    
    Vectors -->|Upload| DB_Vectors[Supabase `document_embeddings`]
    Metadata -->|Upload| DB_Meta[Supabase `documents_catalog`]
    Vectors -->|Log| TLog[Supabase `ingestion_logs`]
```

### Flow breakdown:
1.  **Local State**: The user simply runs `upload.py` on their local machine.
2.  **Persistent Volume**: All files and `metadata.json` configuration are silently transferred directly into a secured cloud Modal workspace mounted at `/data`.
3.  **VRAM Exploitation**: An image provisioned entirely with `PyTorch` and `SentenceTransformers` immediately loops through the volume parsing documents, generating 768-D vectors securely atop container GPUs.
4.  **Graceful Recovery**: State is recorded securely inside `/data/ingestion_state.json` inside the volume, enabling the system to skip prior successfully completed files on repeated runs natively!

---

## 4. The Database Scheme (PostgreSQL + pgvector)

acAIcia splits relational operations cleanly from semantic mathematical operations, relying on a deeply integrated Supabase layout that centralizes system health reporting alongside actual documents.

```mermaid
erDiagram
    documents_catalog ||--o{ document_embeddings : "1 : M"
    documents_catalog {
        uuid id PK
        string title
        string[] authors
        integer publication_year
        string url_link
        string doi
    }
    document_embeddings {
        uuid id PK
        uuid document_id FK
        text chunk_text
        vector embedding "768 dimensions"
    }

    query_interaction_logs {
        uuid log_id PK
        timestamp timestamp
        text original_query
        boolean guardian_passed
        text architect_query
        integer total_tokens_used
        integer latency_ms
    }

    ingestion_logs {
        uuid log_id PK
        string filename
        integer chunks_created
        string status "Success / Failed"
        text error_message
    }
```
