# acAIcia System Architecture

[← Back to README](../README.md)

This dedicated document outlines the high-level infrastructure, multi-agent logic flow, and data pipelines powering **acAIcia**, the CIFOR-ICRAF Research Assistant.

## 1. High-Level Operations Overview

acAIcia relies on a fully serverless, highly decoupled ecosystem split between Streamlit Community Cloud (Frontend), Modal Serverless GPU Containers (Backend APIs & Data Ingestion), and Supabase (Postgres & Vector Store).

```mermaid
flowchart TD
    User([fa:fa-user User]) <-->|HTTPS / UI Interactivity| UI[Streamlit Frontend]
    UI <-->|REST API JSON| API[Modal FastAPI Backend]
    API <-->|SQL Client/RPC| DB[(Supabase Postgres DB)]
    API <-->|Gemini Flash/Pro| LLM[Google AI Studio API]
    
    subgraph Data Ingestion Pipeline
        Admin([fa:fa-user-tie Administrator]) -->|CLI: upload.py| Vol[(Modal Cloud Volume)]
        Vol -->|Event Trigger| Worker[Modal GPU Worker]
        Worker -->|SentenceTransformers| LocalEmbed[Local GPU Embeddings]
        LocalEmbed -->|Insert Vectors| DB
    end
```

## Detailed Modules
For more specific inner workings, consult the specialized documentation:
- [Backend Agents Engine](backend_agents.md)
- [Data Ingestion Pipeline](data_ingestion.md)
- [Frontend Architecture](frontend.md)
- [Database Schema](database_schema.md)
