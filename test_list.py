import os
from google import genai
from dotenv import load_dotenv

load_dotenv("backend/.env")
client = genai.Client()
for m in client.models.list():
    if 'embed' in m.name.lower():
        print(m.name, m.supported_actions)
