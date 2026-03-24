import os
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
client = genai.Client()
response = client.models.embed_content(
    model='text-embedding-004',
    contents='Hello world'
)
print(response.embeddings[0].values[:5])
