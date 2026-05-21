#!/bin/bash
# Script to update Modal secrets for acAIcia LLM configuration

echo "=== acAIcia Modal Secret Updater ==="
echo "This script will update your 'acaicia-llm-secrets' in Modal."

# Prompt for LLM_PROVIDER
read -p "Select LLM Provider (gemini/nvidia/modal) [default: gemini]: " llm_provider
llm_provider=${llm_provider:-gemini}

# Prompt for Google API Key
read -p "Enter GOOGLE_API_KEY (required if provider is gemini, leave blank to keep existing/skip): " google_api_key

# Set USE_NVIDIA based on provider choice
if [ "$llm_provider" = "nvidia" ]; then
    use_nvidia="true"
else
    use_nvidia="false"
fi

# Prompt for NVIDIA_API_KEY
read -p "Enter NVIDIA_API_KEY (required if provider is nvidia, leave blank to keep existing/skip): " nvidia_api_key

# Prompt for HF_TOKEN
read -p "Enter HuggingFace HF_TOKEN (required for modal Gemma 4, leave blank to keep existing/skip): " hf_token

# Build the command string safely
cmd="modal secret create acaicia-llm-secrets --force"

cmd="$cmd LLM_PROVIDER=$llm_provider"
cmd="$cmd USE_NVIDIA=$use_nvidia"

if [ ! -z "$google_api_key" ]; then
    cmd="$cmd GOOGLE_API_KEY=$google_api_key"
fi

if [ ! -z "$nvidia_api_key" ]; then
    cmd="$cmd NVIDIA_API_KEY=$nvidia_api_key"
fi

if [ ! -z "$hf_token" ]; then
    cmd="$cmd HF_TOKEN=$hf_token"
fi

echo ""
echo "Running: $cmd"
eval $cmd

if [ $? -eq 0 ]; then
    echo "Secrets successfully updated on Modal!"
else
    echo "Failed to update secrets."
fi
