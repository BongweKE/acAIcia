import os
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
client = genai.Client()

response = client.models.embed_content(
    model='gemini-embedding-001',
    contents='Hello world'
)
print("Dimensions:", len(response.embeddings[0].values))
