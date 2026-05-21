import modal
import os

image = (
    modal.Image.debian_slim()
    .pip_install("chainlit==2.11.1", "requests")
    .add_local_file("frontend/app.py", "/root/app.py")
)

app = modal.App("test-mounts")

@app.function(image=image)
def test_files():
    print("Files in /root:")
    print(os.listdir("/root"))
    
    print("Current working directory:")
    print(os.getcwd())
    
    print("Files in current directory:")
    print(os.listdir("."))
    
    print("Environment variables:")
    for k, v in os.environ.items():
        if "MODAL" in k or "PATH" in k or "PYTHON" in k:
            print(f"{k}: {v}")
            
    # Print content of /root/app.py (lines 100-125)
    if os.path.exists("/root/app.py"):
        print("Lines 100-125 of /root/app.py:")
        with open("/root/app.py", "r") as f:
            lines = f.readlines()
            for idx in range(100, min(125, len(lines))):
                print(f"{idx+1}: {lines[idx].strip()}")

