import requests
import uuid
import time

BACKEND_URL = "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run"

def run_query(query, session_id, conversation_history=None):
    payload = {
        "query": query,
        "session_id": session_id
    }
    if conversation_history is not None:
        payload["conversation_history"] = conversation_history

    print(f"\n--- Sending Query: '{query}' ---")
    print(f"Session ID: {session_id}")
    print(f"Conversation History Passed: {conversation_history}")
    
    # 1. Post query
    res = requests.post(f"{BACKEND_URL}/query", json=payload)
    res.raise_for_status()
    query_id = res.json()["query_id"]
    print(f"Spawned Query ID: {query_id}")

    # 2. Poll status
    status_url = f"{BACKEND_URL}/query/status/{query_id}"
    while True:
        status_res = requests.get(status_url)
        status_res.raise_for_status()
        status_data = status_res.json()
        status = status_data["status"]
        print(f"Status: {status}...")
        if status == "completed":
            response = status_data["response"]
            print(f"Response: {response}\n")
            return response
        elif status == "failed":
            print(f"Error: {status_data.get('error')}\n")
            return None
        time.sleep(2)

def test():
    # 1. Fetch current settings
    print("Fetching current settings...")
    res = requests.get(f"{BACKEND_URL}/settings")
    res.raise_for_status()
    settings = res.json()
    print(f"Current provider: {settings['llm_provider']}")

    # 2. Update provider to modal (Gemma 4)
    print("Setting LLM provider to 'modal'...")
    res = requests.post(f"{BACKEND_URL}/settings", json={"llm_provider": "modal"})
    res.raise_for_status()
    print(f"Updated provider: {res.json()['llm_provider']}")

    # Use a fresh random session ID
    session_id = f"test-session-{uuid.uuid4().hex[:8]}"
    print(f"Starting test with Session ID: {session_id}")

    # Turn 1: Ask something specific that passes the Guardian check
    run_query(
        query="Which tree species is widely used for agroforestry in the Sahel region?",
        session_id=session_id
    )

    # Turn 2: Follow up referring to the previous question
    run_query(
        query="Explain the main ecological benefits of that species in 1 sentence.",
        session_id=session_id
    )

    # Turn 3: Start a new chat (simulated by passing conversation_history=[])
    run_query(
        query="Explain the main ecological benefits of that species in 1 sentence.",
        session_id=session_id,
        conversation_history=[]
    )

if __name__ == "__main__":
    test()
