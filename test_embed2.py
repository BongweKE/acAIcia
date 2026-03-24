import os
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
client = genai.Client()

models = [m.name for m in client.models.list()]
print("All models:", models)

try:
    response = client.models.embed_content(
        model='text-embedding-004',
        contents='Hello world'
    )
    print("Success with text-embedding-004!")
except Exception as e:
    print("Error:", e)
