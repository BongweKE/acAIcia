#!/usr/bin/env python3
import os
import sys
import subprocess
import re

def print_header(title):
    print("\n" + "=" * 60)
    print(f" {title} ".center(60, "="))
    print("=" * 60)

def read_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    env_vars[key.strip()] = val.strip().strip('"').strip("'")
    return env_vars

def write_env(env_path, env_vars):
    lines = []
    existing_lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            existing_lines = f.readlines()
            
    written_keys = set()
    for line in existing_lines:
        stripped = line.strip()
        if stripped.startswith("#") or not stripped:
            lines.append(line)
        elif "=" in stripped:
            key, _ = stripped.split("=", 1)
            key = key.strip()
            if key in env_vars:
                lines.append(f'{key}="{env_vars[key]}"\n')
                written_keys.add(key)
            else:
                lines.append(line)
                
    for key, val in env_vars.items():
        if key not in written_keys:
            lines.append(f'{key}="{val}"\n')
            
    with open(env_path, "w") as f:
        f.writelines(lines)

def get_modal_cmd():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_modal = os.path.join(base_dir, ".venv", "bin", "modal")
    if os.path.exists(venv_modal):
        return venv_modal
    return "modal"

def configure_settings(env_path):
    print_header("Configure acAIcia LLM Settings")
    env_vars = read_env(env_path)
    
    # 1. Choose Provider
    print("Select LLM Provider:")
    print("1) Google Gemini API (gemini)")
    print("2) NVIDIA NIM API (nvidia)")
    print("3) Modal Gemma 4 (modal)")
    
    current_provider = env_vars.get("LLM_PROVIDER", "gemini")
    choice = input(f"Select choice (1-3) [current: {current_provider}]: ").strip()
    
    provider = current_provider
    if choice == "1":
        provider = "gemini"
    elif choice == "2":
        provider = "nvidia"
    elif choice == "3":
        provider = "modal"
        
    env_vars["LLM_PROVIDER"] = provider
    env_vars["USE_NVIDIA"] = "true" if provider == "nvidia" else "false"
    
    # 2. Prompt for API keys & credentials
    google_key = input(f"Enter GOOGLE_API_KEY [current: {env_vars.get('GOOGLE_API_KEY', 'not set')}]: ").strip()
    if google_key:
        env_vars["GOOGLE_API_KEY"] = google_key
        
    nvidia_key = input(f"Enter NVIDIA_API_KEY [current: {env_vars.get('NVIDIA_API_KEY', 'not set')}]: ").strip()
    if nvidia_key:
        env_vars["NVIDIA_API_KEY"] = nvidia_key
        
    hf_token = input(f"Enter HuggingFace HF_TOKEN [current: {env_vars.get('HF_TOKEN', 'not set')}]: ").strip()
    if hf_token:
        env_vars["HF_TOKEN"] = hf_token
        
    # Write to local backend/.env
    write_env(env_path, env_vars)
    print("\n✓ Settings saved to local backend/.env successfully!")
    
    # 3. Push to Modal Secrets
    push = input("Do you want to update 'acaicia-llm-secrets' in Modal? (y/n) [default: y]: ").strip().lower()
    if push != 'n':
        print("\nUpdating Modal secrets...")
        # Build command safely
        modal_bin = get_modal_cmd()
        cmd = [modal_bin, "secret", "create", "acaicia-llm-secrets", "--force"]
        
        # Add variables
        for key in ["LLM_PROVIDER", "USE_NVIDIA", "GOOGLE_API_KEY", "NVIDIA_API_KEY", "HF_TOKEN"]:
            if key in env_vars:
                cmd.append(f'{key}={env_vars[key]}')
                
        try:
            res = subprocess.run(cmd)
            if res.returncode == 0:
                print("✓ Modal secrets updated successfully!")
            else:
                print(f"⚠️ Modal secrets update failed with exit code: {res.returncode}")
        except Exception as e:
            print(f"Error updating Modal secrets: {e}")
            
    # 4. Sync Settings on persistent volume if possible
    sync = input("Do you want to sync LLM provider configuration with the active volume state? (y/n) [default: y]: ").strip().lower()
    if sync != 'n':
        backend_url = None
        base_dir = os.path.dirname(os.path.abspath(__file__))
        frontend_app_path = os.path.join(base_dir, "frontend", "app.py")
        if os.path.exists(frontend_app_path):
            with open(frontend_app_path, "r") as f:
                content = f.read()
                m = re.search(r'BACKEND_URL\s*=\s*["\'](https://[^\'\"]+)["\']', content)
                if m:
                    backend_url = m.group(1)
                    
        if backend_url:
            settings_url = backend_url.replace("/query", "/settings")
            print(f"Calling settings API at: {settings_url} ...")
            try:
                import requests
                res = requests.post(settings_url, json={"llm_provider": provider}, timeout=10)
                if res.status_code == 200:
                    print(f"✓ Persistent volume settings successfully synced with LLM provider: {provider}")
                else:
                    print(f"⚠️ Failed to sync volume settings via API: {res.text}")
            except Exception as e:
                print(f"⚠️ Could not connect to backend API: {e}. You may need to deploy the backend first.")
        else:
            print("⚠️ BACKEND_URL could not be found in frontend/app.py. Cannot sync volume settings via API.")

def deploy_inference():
    print_header("Deploying Gemma 4 Inference App to Modal")
    try:
        modal_bin = get_modal_cmd()
        subprocess.run([modal_bin, "deploy", "backend/gemma_inference.py"], check=True)
        print("✓ Gemma 4 inference app successfully deployed!")
    except Exception as e:
        print(f"Error deploying inference app: {e}")

def deploy_backend():
    print_header("Deploying Main Backend App to Modal")
    try:
        modal_bin = get_modal_cmd()
        subprocess.run([modal_bin, "deploy", "backend/app.py"], check=True)
        print("✓ Main backend app successfully deployed!")
    except Exception as e:
        print(f"Error deploying backend app: {e}")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(base_dir, "backend", ".env")
    
    while True:
        print_header("acAIcia Administration Console")
        print("1) Configure Local & Modal Cloud LLM Settings")
        print("2) Deploy Gemma 4 Inference App to Modal")
        print("3) Deploy main FastAPI Backend App to Modal")
        print("4) Exit")
        
        choice = input("Enter option (1-4): ").strip()
        if choice == "1":
            configure_settings(env_path)
        elif choice == "2":
            deploy_inference()
        elif choice == "3":
            deploy_backend()
        elif choice == "4":
            print("Exiting.")
            break
        else:
            print("Invalid choice. Please choose again.")

if __name__ == "__main__":
    main()
