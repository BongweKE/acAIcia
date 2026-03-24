import os
import sys
import glob
import subprocess

def upload_to_volume(directory="data"):
    if not os.path.exists(directory):
        print(f"Directory '{directory}' does not exist. Creating it.")
        os.makedirs(directory)
        print(f"Please drop your pdf, md, docx, or pptx files into {directory}/ and run this script again.")
        return False
        
    files = [f for f in glob.glob(f"{directory}/*.*") if f.lower().endswith(('.pdf', '.md', '.docx', '.pptx', '.json'))]
    if not files:
        print(f"No documents or metadata found in {directory}/")
        return False
        
    # Ensure modal volume commands work by parsing standard syntax
    print(f"Uploading {len(files)} files to Modal Volume (acaicia-data-volume)...")
    for f in files:
        try:
            print(f"   Pushing {f}...")
            # Pushes the file to the root of the modal volume mounted at /data inside containers, overwriting if it exists
            subprocess.run(["modal", "volume", "put", "--force", "acaicia-data-volume", f, "/"], check=True)
        except subprocess.CalledProcessError as e:
            print(f"Failed to push {f} to Volume: {e}")
            return False
            
    print("Upload complete!")
    return True

if __name__ == "__main__":
    if upload_to_volume():
        print("Starting modal execution cluster...")
        try:
            subprocess.run(["modal", "run", "app.py"], check=True)
            print("System fully synched!")
        except Exception as e:
            print(f"App processing crashed: {e}")
