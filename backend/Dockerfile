# acAIcia standalone backend (Railway) — FastAPI + Mistral, no Modal dependency.
# Build context: repository root (service config sets dockerfilePath = backend/Dockerfile).
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/hf-cache \
    TOKENIZERS_PARALLELISM=false \
    ACAICIA_DATA_DIR=/tmp/acaicia-data

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch first — avoids ~2GB of CUDA wheels sentence-transformers would pull.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY backend/requirements-railway.txt /app/backend/requirements-railway.txt
RUN pip install --no-cache-dir -r /app/backend/requirements-railway.txt

# Bake the retrieval embedding model and reranker into the image so cold starts never download them.
# Must match the model used to embed the Supabase corpus (768-dim bge-base-en-v1.5).
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; SentenceTransformer('BAAI/bge-base-en-v1.5'); CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# Application package + benchmark datasets used by the evaluation engine.
COPY backend/ /app/backend/
COPY test_questions.csv test_questions_difficult.csv test_questions_fire_mgt.csv test_question_soils.csv test_questions_randomized.csv /app/

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-8000}/health" || exit 1

CMD ["sh", "-c", "uvicorn backend.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
