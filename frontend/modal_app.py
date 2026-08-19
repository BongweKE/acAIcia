import modal
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

frontend_dir = Path(__file__).parent
dist_dir = frontend_dir / "dist"

app = modal.App("acaicia-frontend")

image = (
    modal.Image.debian_slim()
    .pip_install("fastapi[standard]")
    .add_local_dir(dist_dir, "/root/dist")
)

@app.function(image=image, max_containers=5, timeout=3600)
@modal.asgi_app()
def fastapi_app_entrypoint():
    fastapi_app = FastAPI(title="acAIcia Frontend")
    fastapi_app.mount("/", StaticFiles(directory="/root/dist", html=True), name="static")
    return fastapi_app
