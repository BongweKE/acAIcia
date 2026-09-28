"""Shared, framework-agnostic configuration for the acAIcia backend.

Extracted from the original Modal ``app.py`` so that both the legacy Modal
deployment and the standalone Railway server share a single source of truth.
No Modal imports here on purpose — this module must import cleanly anywhere.
"""

from __future__ import annotations

from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# LLM Provider Cost Table (USD per 1M tokens — public rates)
# ─────────────────────────────────────────────────────────────────────────────
COST_PER_1M_TOKENS: dict[str, dict[str, float]] = {
    "gemini": {"input": 1.50, "output": 7.50},  # Gemini 2.5 Flash
    "nvidia": {"input": 0.35, "output": 0.40},  # Llama 3.3 70B via NVIDIA NIM
    "deepseek": {"input": 0.44, "output": 0.88},  # DeepSeek Reasoner
    "modal": {"input": 0.0, "output": 0.0},  # Self-hosted Gemma on Modal GPU
    # Mistral Small 4 (mistral-small-latest) — synthesis/architect. Verified
    # 2026-09 against https://mistral.ai/pricing/api/ (was $0.10/$0.30).
    # Guardian uses ministral-3b-latest ($0.10/$0.10), judge ministral-8b ($0.15/$0.15).
    "mistral": {"input": 0.15, "output": 0.60},  # Mistral Small 4 — DEFAULT
}

ALLOWED_PROVIDERS = ["gemini", "nvidia", "modal", "deepseek", "mistral"]
DEFAULT_PROVIDER = "mistral"

# Mistral model identifiers (verified against api.mistral.ai /v1/models).
MISTRAL_GUARDIAN_MODEL = "ministral-3b-latest"
MISTRAL_SYNTHESIS_MODEL = "mistral-small-latest"
MISTRAL_JUDGE_MODEL = "ministral-8b-latest"
MISTRAL_CLASSIFIER_MODEL = "ministral-3b-latest"
MISTRAL_FALLBACK_GUARDIAN_MODEL = "ministral-3b-latest"
MISTRAL_FALLBACK_SYNTHESIS_MODEL = "ministral-8b-latest"

AGENT_MAX_TOKENS = {"guardian": 16, "architect": 256, "synthesis": 2048}
AGENT_TEMPERATURE = {"guardian": 0.0, "architect": 0.2, "synthesis": 0.7}

CACHE_SIMILARITY_THRESHOLD = 0.98
RAGAS_SAMPLE_RATE = 0.05

EMBED_MODEL_NAME = "BAAI/bge-base-en-v1.5"

# ─────────────────────────────────────────────────────────────────────────────
# Topic Taxonomy — mirrors the Guardian agent's allowed domain list
# ─────────────────────────────────────────────────────────────────────────────
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "peatlands": [
        "peat",
        "peatland",
        "groundwater",
        "hydrology",
        "subsidence",
        "drainage",
        "tropical peat",
        "hemic",
        "sapric",
        "water table",
    ],
    "fire_management": [
        "fire",
        "prescribed burn",
        "smoke",
        "haze",
        "globalrx",
        "wildfire",
        "burning",
        "respiratory",
        "combustion",
        "burnt area",
        "fire management",
    ],
    "food_systems": [
        "food system",
        "ghg",
        "greenhouse gas",
        "emission",
        "food supply",
        "crop",
        "livestock",
        "land use",
        "diet",
        "agriculture",
        "food emission",
    ],
    "agroforestry": [
        "agroforestry",
        "silvopasture",
        "tree",
        "forest",
        "woodland",
        "canopy",
        "shade",
        "intercrop",
        "fallow",
        "reforestation",
        "afforestation",
        "timber",
    ],
    "climate_change": [
        "climate",
        "carbon",
        "co2",
        "sequestration",
        "mitigation",
        "adaptation",
        "warming",
        "ipcc",
        "temperature",
        "blue carbon",
        "mangrove",
        "ghg",
    ],
    "soil_science": [
        "soil",
        "organic carbon",
        "soc",
        "erosion",
        "degradation",
        "fertility",
        "nitrogen",
        "phosphorus",
        "microbiome",
        "rhizosphere",
        "soil carbon",
    ],
    "biodiversity": [
        "biodiversity",
        "species",
        "wildlife",
        "mammal",
        "habitat",
        "ecology",
        "conservation",
        "endemic",
        "fauna",
        "flora",
        "ecosystem",
    ],
    "policy": [
        "policy",
        "governance",
        "law",
        "regulation",
        "ndcs",
        "redd",
        "treaty",
        "convention",
        "cbd",
        "unfccc",
        "land rights",
        "tenure",
        "legal",
    ],
    "methodology": [
        "remote sensing",
        "satellite",
        "lidar",
        "survey",
        "methodology",
        "mapping",
        "modelling",
        "dataset",
        "machine learning",
        "ai model",
        "gis",
    ],
}

ADMIN_AUTH_NOTE = (
    "Set Authorization: Bearer <ADMIN_API_KEY>. "
    "If ADMIN_API_KEY is unset, admin access is open (transition mode)."
)
