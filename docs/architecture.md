# acAIcia System Architecture

[← Back to README](../README.md)

This dedicated document outlines the high-level infrastructure, multi-agent logic flow, and data pipelines powering **acAIcia**, the CIFOR-ICRAF Research Assistant.

## 1. High-Level Operations Overview

acAIcia relies on a fully serverless, highly decoupled ecosystem split between Streamlit (Frontend), Modal Serverless Containers (FastAPI Backend, Persistent Settings Volume, and Self-Hosted Gemma 4 Inference Service), and Supabase (Postgres & Vector Store).

```mermaid
flowchart TD
    User([fa:fa-user User]) <-->|HTTPS / UI Interactivity| UI[Streamlit Frontend]
    UI <-->|REST API JSON /query & /settings| API[Modal FastAPI Backend]
    API <-->|SQL Client/RPC| DB[(Supabase Postgres DB)]
    
    %% Config & Volume
    API <-->|Read/Write settings.json| Vol[(Modal Persistent Volume)]
    
    %% Provider Routing
    subgraph LLM Providers
        API -->|Option 1: Gemini API| Gemini[Google AI Studio]
        API -->|Option 2: NVIDIA NIM API| NIM[NVIDIA NIM endpoints]
        API <-->|Option 3: Modal RPC| Gemma[Modal Gemma 4 Inference Service]
    end
    
    %% Ingestion
    subgraph Data Ingestion Pipeline
        IngestAdmin([fa:fa-user-tie Administrator]) -->|CLI: upload.py| IngestVol[(Modal Cloud Ingestion Volume)]
        IngestVol -->|Event Trigger| Worker[Modal GPU Worker]
        Worker -->|SentenceTransformers| LocalEmbed[Local GPU Embeddings]
        LocalEmbed -->|Insert Vectors| DB
    end

    %% CLI Administration
    subgraph Local Administration
        Admin([fa:fa-user-cog Admin]) -->|cli_admin.py| Env[backend/.env]
        Admin -->|cli_admin.py / update_secrets.sh| Secrets[Modal Secrets Manager]
        Admin -.->|cli_admin.py API Call| API
    end
```

## Detailed Modules
For more specific inner workings, consult the specialized documentation:
- [Backend Agents Engine](backend_agents.md)
- [Data Ingestion Pipeline](data_ingestion.md)
- [Frontend Architecture](frontend.md)
- [Database Schema](database_schema.md)
