import os
import asyncio
import random
import requests
import chainlit as cl
from chainlit.input_widget import Select
from pathlib import Path

# Constants
# DO NOT MODIFY the line below. The CLI admin tool parses this regex string to find the backend URL.
BACKEND_URL = "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/query"

# Allow overriding via environment variable
API_URL = os.environ.get("BACKEND_URL", BACKEND_URL)
SETTINGS_URL = API_URL.replace("/query", "/settings")

FRONTEND_DIR = Path(__file__).parent

# Curated array of thinking/processing phrases shown during query execution.
# To customize: add, remove, or modify entries in this list.
# A random phrase is selected on each query and refreshed every ~8 seconds.
THINKING_PHRASES = [
    "Thinking...",
    "Researching...",
    "Analyzing...",
    "Consulting the knowledge base...",
    "Synthesizing findings...",
    "Reviewing literature...",
    "Cross-referencing sources...",
    "Formulating response...",
    "Exploring the evidence...",
    "Processing your query...",
]

@cl.on_chat_start
async def start():

    # Fetch backend settings on startup (with retries for backend cold start)
    provider_name = "gemini"
    backend_connected = False
    
    max_retries = 6
    for attempt in range(max_retries):
        try:
            # Run synchronous requests in a thread to keep the loop free
            res = await asyncio.to_thread(requests.get, SETTINGS_URL, timeout=15)
            if res.status_code == 200:
                settings = res.json()
                provider_name = settings.get("llm_provider", "gemini")
                backend_connected = True
                break
        except Exception:
            if attempt < max_retries - 1:
                await asyncio.sleep(2)
            else:
                pass

    # Build main welcome card — logo, name, tagline only
    welcome_html = """<div class="acaicia-welcome-card">
<div class="acaicia-welcome-header">
<div class="acaicia-logo-emoji">🌿</div>
<div class="acaicia-title-container">
<h1 class="acaicia-title">acAIcia</h1>
<p class="acaicia-subtitle">CIFOR-ICRAF Expert Research Assistant</p>
</div>
</div>
</div>"""

    await cl.Message(content=welcome_html, author="acAIcia").send()

    # Build temporary description card — removed on first user message
    desc_html = """<div class="acaicia-info-card">
<p class="acaicia-info-text">Ask me questions related to forestry, agroforestry, climate change, biodiversity, and CIFOR-ICRAF's research areas. I retrieve scientific evidence from our internal publication knowledge base and synthesize answers with standard scientific citations.</p>
</div>"""

    temp_msg = cl.Message(content=desc_html, author="acAIcia")
    await temp_msg.send()
    # Store the message ID so we can remove it on first user message
    cl.user_session.set("temp_info_msg_id", temp_msg.id)

    # Setup ChatSettings for LLM Provider
    settings = cl.ChatSettings([
        Select(
            id="llm_provider",
            label="LLM Provider",
            initial_value=provider_name,
            items={
                "Google Gemini API": "gemini",
                "NVIDIA NIM API": "nvidia",
                "DeepSeek API": "deepseek",
                "Modal Gemma 4 (Self-Hosted)": "modal"
            }
        )
    ])
    await settings.send()

@cl.on_settings_update
async def setup_agent(settings):
    provider = settings.get("llm_provider")
    if not provider:
        return
        
    try:
        res = await asyncio.to_thread(
            requests.post,
            SETTINGS_URL,
            json={"llm_provider": provider},
            timeout=10
        )
        if res.status_code == 200:
            provider_display = {
                "gemini": "Google Gemini API",
                "nvidia": "NVIDIA NIM API",
                "deepseek": "DeepSeek API",
                "modal": "Modal Gemma 4 (Self-Hosted)"
            }.get(provider, provider)
            await cl.Message(content=f"⚙️ **System Update:** LLM provider changed to `{provider_display}` successfully.", author="acAIcia").send()
        else:
            await cl.Message(content=f"⚠️ **Failed to update settings:** Backend returned status {res.status_code}", author="acAIcia").send()
    except Exception as e:
        await cl.Message(content=f"⚠️ **Error updating settings:** {e}", author="acAIcia").send()

@cl.on_message
async def main(message: cl.Message):
    user_query = message.content.strip()

    # Remove the temporary info card on first message
    temp_msg_id = cl.user_session.get("temp_info_msg_id")
    if temp_msg_id:
        try:
            await cl.Message(id=temp_msg_id, content="").remove()
        except Exception:
            pass  # Already removed or not found
        cl.user_session.set("temp_info_msg_id", None)
    
    # Warning for file uploads
    if message.elements:
        file_names = [e.name for e in message.elements]
        files_str = ", ".join(f"`{name}`" for name in file_names)
        await cl.Message(
            author="acAIcia",
            content=f"📎 **Attached Files:** {files_str}\n\n*Note: Direct attachments are processed for the current query only. To permanently ingest publications into the RAG database, please use the admin CLI (`cli_admin.py`).*"
        ).send()

    if not user_query:
        return

    # 1. Post query to backend to initiate async task
    try:
        init_response = await asyncio.to_thread(
            requests.post,
            API_URL,
            json={"query": user_query},
            timeout=15
        )
        init_response.raise_for_status()
        init_data = init_response.json()
        
        query_id = init_data.get("query_id")
        if not query_id:
            raise Exception("Backend did not return a query ID.")
    except Exception as e:
        await cl.Message(content=f"⚠️ An error occurred while connecting to the backend: {e}", author="acAIcia").send()
        return

    # 2. Poll status API with a visual step and randomized thinking phrases
    status_url = API_URL.replace("/query", f"/query/status/{query_id}")
    max_polls = 120  # 4 minutes maximum wait time
    poll_interval = 2.0  # poll every 2 seconds
    
    answer = None
    sources = []
    
    async with cl.Step(name="acAIcia Multi-Agent Pipeline", type="run") as step:
        phrase = random.choice(THINKING_PHRASES)
        for poll_idx in range(max_polls):
            # Refresh the thinking phrase every ~8 seconds (4 polls)
            if poll_idx % 4 == 0 and poll_idx > 0:
                phrase = random.choice(THINKING_PHRASES)
            
            step.output = f"🌿 {phrase}"
            await step.update()
            
            try:
                status_res = await asyncio.to_thread(requests.get, status_url, timeout=10)
                if status_res.status_code == 200:
                    status_data = status_res.json()
                    current_status = status_data.get("status")
                    
                    if current_status == "completed":
                        answer = status_data.get("response", "No response generated.")
                        sources = status_data.get("sources", [])
                        step.output = "Pipeline execution complete."
                        break
                    elif current_status == "failed":
                        raise Exception(status_data.get("error", "Unknown error during processing."))
            except Exception as poll_err:
                # If connection error during poll, retry unless it is a failure state
                if "failed" in str(poll_err).lower():
                    step.output = f"Pipeline execution failed: {poll_err}"
                    raise poll_err
            
            await asyncio.sleep(poll_interval)

    if answer is None:
        await cl.Message(content="⚠️ Request timed out or failed on the backend.", author="acAIcia").send()
        return

    # 3. Format response with custom CSS classes for citation blocks
    response_content = answer

    if sources:
        citations_html = "\n\n<div class='source-container'>"
        citations_html += "<div class='source-header-title'>🌿 Sources & Citations</div>"
        for idx, src in enumerate(sources):
            title = src.get('title', 'Unknown Title')
            authors = src.get('authors', 'Unknown Authors')
            year = src.get('year', 'n.d.')
            doi = src.get('doi', '')
            url = src.get('url', '')
            
            doi_link = f"<a href='https://doi.org/{doi}' target='_blank'>DOI: {doi}</a>" if doi else ""
            url_link = f"<a href='{url}' target='_blank'>Reference Link</a>" if url else ""
            
            links = " | ".join(filter(None, [doi_link, url_link]))
            links_div = f"<div class='source-links'>{links}</div>" if links else ""
            
            citations_html += f"""
<div class='source-item'>
    <div class='source-title'>[{idx+1}] {title}</div>
    <div class='source-authors'><i>Authors:</i> {authors} ({year})</div>
    {links_div}
</div>"""
        citations_html += "</div>"
        response_content += citations_html

    # Send the final response to the user
    await cl.Message(content=response_content, author="acAIcia").send()
