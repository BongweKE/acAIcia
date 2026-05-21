import os
import re
import subprocess
import modal
from pathlib import Path

# Path to local frontend files
frontend_dir = Path(__file__).parent
app_path = frontend_dir / "app.py"

# Extract BACKEND_URL from app.py to bake into the container image
backend_url = ""
if app_path.exists():
    with open(app_path, "r") as f:
        content = f.read()
        m = re.search(r'BACKEND_URL\s*=\s*["\'](https://[^\'\"]+)["\']', content)
        if m:
            backend_url = m.group(1)

print(f"Detected backend URL: {backend_url}")

# Define the Modal application
app = modal.App("acaicia-frontend")

# Define the container image with required libraries
image = (
    modal.Image.debian_slim()
    .pip_install("chainlit==2.11.1", "requests")
    .env({
        "BACKEND_URL": backend_url,
        "CHAINLIT_DISABLE_ORIGIN_CHECK": "true"
    })
    .add_local_file(app_path, "/root/app.py")
)

# Copy public assets and configuration if they exist locally
public_dir = frontend_dir / "public"
if public_dir.exists():
    image = image.add_local_dir(public_dir, "/root/public")

config_path = frontend_dir / ".chainlit" / "config.toml"
if config_path.exists():
    image = image.add_local_file(config_path, "/root/.chainlit/config.toml")

chainlit_md_path = frontend_dir / "chainlit.md"
if chainlit_md_path.exists():
    image = image.add_local_file(chainlit_md_path, "/root/chainlit.md")

@app.function(image=image, max_containers=1, timeout=86400)
@modal.web_server(8000)
@modal.concurrent(max_inputs=100)
def run():
    # Start the Chainlit server on port 8000 (bind to 0.0.0.0, headless)
    cmd = "cd /root && chainlit run app.py --port 8000 --host 0.0.0.0 -h"
    subprocess.Popen(cmd, shell=True)
