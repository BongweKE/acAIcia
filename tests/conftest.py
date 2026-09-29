import os

# Set dummy environment variables for tests when running in CI or environments without .env
os.environ.setdefault("SUPABASE_URL", "https://mock.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "mock-key-for-testing")
os.environ.setdefault("ADMIN_API_KEY", "test-admin-key")
os.environ.setdefault("MISTRAL_API_KEY", "mock-mistral-key")
