import os
import asyncio
import random
import uuid
import requests
import chainlit as cl
from chainlit.input_widget import Select, TextInput
from pathlib import Path

# Constants
# DO NOT MODIFY the line below. The CLI admin tool parses this regex string to find the backend URL.
BACKEND_URL = "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/query"

API_URL = os.environ.get("BACKEND_URL", BACKEND_URL)
SETTINGS_URL = API_URL.replace("/query", "/settings")
USER_SETTINGS_URL = API_URL.replace("/query", "/user/settings")
FEEDBACK_URL = API_URL.replace("/query", "/feedback")
ADMIN_METRICS_URL = API_URL.replace("/query", "/admin/metrics")

FRONTEND_DIR = Path(__file__).parent

THINKING_PHRASES = [
    "Searching the knowledge base for relevant publications…",
    "Retrieving scientific evidence from our research archive…",
    "Analyzing your query against thousands of publications…",
    "Cross-referencing sources across forestry and climate literature…",
    "Synthesizing findings from multiple research papers…",
    "Consulting peer-reviewed publications on this topic…",
    "Evaluating relevance of retrieved documents…",
    "Building a comprehensive answer with proper citations…",
    "Reviewing biodiversity and ecosystem research…",
    "Processing through the multi-agent research pipeline…",
    "Matching your question to our agroforestry knowledge base…",
    "Extracting key insights from scientific literature…",
    "Formulating a well-cited response for you…",
    "Scanning landscape restoration and conservation studies…",
]

@cl.on_chat_start
async def start():
    session_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    cl.user_session.set("session_id", session_id)
    cl.user_session.set("user_id", user_id)
    cl.user_session.set("conversation_history", [])

    provider_name = "gemini"
    max_retries = 6
    for attempt in range(max_retries):
        try:
            res = await asyncio.to_thread(requests.get, SETTINGS_URL, timeout=15)
            if res.status_code == 200:
                settings = res.json()
                provider_name = settings.get("llm_provider", "gemini")
                break
        except Exception:
            if attempt < max_retries - 1:
                await asyncio.sleep(2)

    welcome_html = """<div class="acaicia-welcome-card">
<div class="acaicia-welcome-header">
<svg class="acaicia-logo-svg" viewBox="0 0 100 100" width="64" height="64">
  <g class="acacia-fill">
    <path d="M 47 80 C 47 70, 48 62, 46 56 C 44 50, 36 46, 28 43 L 30 40 C 38 43, 45 47, 48 52 C 49 48, 51 45, 54 42 C 60 38, 68 37, 76 36 L 77 39 C 70 40, 62 41, 57 45 C 54 49, 52 80 Z" />
    <path d="M 48 54 C 45 50, 41 47, 36 45 L 37 42 C 43 44, 47 48, 49 51 Z" />
    <path d="M 54 48 C 57 44, 63 41, 69 40 L 70 43 C 65 44, 59 47, 56 51 Z" />
    <ellipse cx="50" cy="30" rx="36" ry="7" />
    <ellipse cx="32" cy="38" rx="22" ry="6" />
    <ellipse cx="68" cy="38" rx="22" ry="6" />
    <ellipse cx="50" cy="24" rx="24" ry="5" />
    <ellipse cx="18" cy="41" rx="10" ry="4" />
    <ellipse cx="82" cy="41" rx="10" ry="4" />
  </g>
</svg>
<div class="acaicia-title-container">
<h1 class="acaicia-title">acAIcia</h1>
<p class="acaicia-subtitle">An AI research assistant from the Landscape Alliance powered by CIFOR & ICRAF</p>
</div>
</div>
</div>"""

    await cl.Message(content=welcome_html, author="acAIcia").send()

    desc_html = """<div class="acaicia-info-card">
<p class="acaicia-info-text">Ask me questions related to forestry, agroforestry, climate change, peatlands, food systems, biodiversity, and Landscape Alliance's research areas. Type <code>/settings</code> to configure your profile or <code>/admin</code> to view RAG telemetry.</p>
</div>"""

    temp_msg = cl.Message(content=desc_html, author="acAIcia")
    await temp_msg.send()
    cl.user_session.set("temp_info_msg_id", temp_msg.id)

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
        res = await asyncio.to_thread(requests.post, SETTINGS_URL, json={"llm_provider": provider}, timeout=10)
        if res.status_code == 200:
            provider_display = {"gemini": "Google Gemini API", "nvidia": "NVIDIA NIM API", "deepseek": "DeepSeek API", "modal": "Modal Gemma 4"}.get(provider, provider)
            await cl.Message(content=f"⚙️ **System Update:** LLM provider changed to `{provider_display}`.", author="acAIcia").send()
    except Exception as e:
        await cl.Message(content=f"⚠️ **Error updating settings:** {e}", author="acAIcia").send()

# Handle in-chat upvote/downvote feedback
@cl.action_callback("upvote")
async def on_upvote(action: cl.Action):
    log_id = action.value
    user_id = cl.user_session.get("user_id")
    try:
        await asyncio.to_thread(requests.post, FEEDBACK_URL, json={"log_id": log_id, "user_id": user_id, "rating": 1}, timeout=5)
        await cl.Message(content="👍 *Thank you for your feedback!*", author="acAIcia").send()
    except Exception as e:
        await cl.Message(content=f"⚠️ Error sending feedback: {e}", author="acAIcia").send()

@cl.action_callback("downvote")
async def on_downvote(action: cl.Action):
    log_id = action.value
    user_id = cl.user_session.get("user_id")
    try:
        await asyncio.to_thread(requests.post, FEEDBACK_URL, json={"log_id": log_id, "user_id": user_id, "rating": -1}, timeout=5)
        await cl.Message(content="👎 *Thank you for your feedback. We logged this response for quality evaluation.*", author="acAIcia").send()
    except Exception as e:
        await cl.Message(content=f"⚠️ Error sending feedback: {e}", author="acAIcia").send()

@cl.on_message
async def main(message: cl.Message):
    user_query = message.content.strip()

    temp_msg_id = cl.user_session.get("temp_info_msg_id")
    if temp_msg_id:
        try:
            await cl.Message(id=temp_msg_id, content="").remove()
        except Exception:
            pass
        cl.user_session.set("temp_info_msg_id", None)

    # 1. Special Command: User Settings UI
    if user_query.lower() == "/settings":
        settings_html = """<div class="acaicia-settings-card">
<div class="acaicia-settings-header">
<h2 class="acaicia-settings-title">User <span>Settings & Profile</span></h2>
</div>
<div class="acaicia-settings-form-group">
<label class="acaicia-settings-label">Full Name</label>
<p style="color:#a3bca7; margin:0 0 10px 0;">Guest Researcher</p>
</div>
<div class="acaicia-settings-form-group">
<label class="acaicia-settings-label">What preferences should acAIcia consider in responses?</label>
<p style="color:#8fa794; font-size:0.88rem; margin:4px 0 8px 0;">acAIcia will keep this custom instruction in mind across chats (e.g. <i>"Focus on East Africa agroforestry policy briefs"</i>)</p>
</div>
<p>To update your custom research instructions, type: <code>/set_instructions [your custom instructions here]</code></p>
</div>"""
        await cl.Message(content=settings_html, author="acAIcia").send()
        return

    # Handle /set_instructions command
    if user_query.lower().startswith("/set_instructions"):
        instructions = user_query[len("/set_instructions"):].strip()
        user_id = cl.user_session.get("user_id")
        try:
            res = await asyncio.to_thread(requests.post, USER_SETTINGS_URL, json={"user_id": user_id, "custom_instructions": instructions}, timeout=10)
            if res.status_code == 200:
                await cl.Message(content=f"✓ **Custom Instructions Updated:** `{instructions}` will now be applied to Synthesis across your chats.", author="acAIcia").send()
            else:
                await cl.Message(content=f"⚠️ Failed to update instructions: status {res.status_code}", author="acAIcia").send()
        except Exception as e:
            await cl.Message(content=f"⚠️ Error updating settings: {e}", author="acAIcia").send()
        return

    # 2. Special Command: Admin Metrics Dashboard
    if user_query.lower() == "/admin":
        try:
            m_res = await asyncio.to_thread(requests.get, ADMIN_METRICS_URL, timeout=10)
            if m_res.status_code == 200:
                m = m_res.json()
                st = m.get("stage_latency_averages", {})
                fb = m.get("user_feedback", {})
                admin_html = f"""<div class="acaicia-admin-container">
<h2 class="acaicia-admin-title">🌿 acAIcia Admin & RAG Observability Dashboard</h2>
<div class="acaicia-admin-metrics-grid">
  <div class="acaicia-admin-card"><div class="acaicia-admin-card-val">{m.get('total_queries', 0)}</div><div class="acaicia-admin-card-lbl">Total Queries</div></div>
  <div class="acaicia-admin-card"><div class="acaicia-admin-card-val">{m.get('cache_hit_rate_pct', 0)}%</div><div class="acaicia-admin-card-lbl">Cache Hit Rate</div></div>
  <div class="acaicia-admin-card"><div class="acaicia-admin-card-val">{m.get('p95_latency_ms', 0)}ms</div><div class="acaicia-admin-card-lbl">p95 Latency</div></div>
  <div class="acaicia-admin-card"><div class="acaicia-admin-card-val">{fb.get('satisfaction_pct', 100)}%</div><div class="acaicia-admin-card-lbl">User Satisfaction ({fb.get('upvotes', 0)}👍 / {fb.get('downvotes', 0)}👎)</div></div>
</div>
<h3>Latency Breakdown by Agent Stage</h3>
<div class="acaicia-latency-bar-container">
  <div class="acaicia-latency-row"><span class="acaicia-latency-label">Guardian Agent:</span><span>{st.get('guardian_ms', 0)} ms</span></div>
  <div class="acaicia-latency-row"><span class="acaicia-latency-label">Architect Agent:</span><span>{st.get('architect_ms', 0)} ms</span></div>
  <div class="acaicia-latency-row"><span class="acaicia-latency-label">Hybrid Retrieval:</span><span>{st.get('retrieval_ms', 0)} ms</span></div>
  <div class="acaicia-latency-row"><span class="acaicia-latency-label">Synthesis Agent:</span><span>{st.get('synthesis_ms', 0)} ms</span></div>
</div>
</div>"""
                await cl.Message(content=admin_html, author="acAIcia").send()
            else:
                await cl.Message(content=f"⚠️ Failed to fetch admin metrics: {m_res.status_code}", author="acAIcia").send()
        except Exception as e:
            await cl.Message(content=f"⚠️ Error fetching admin metrics: {e}", author="acAIcia").send()
        return

    if not user_query:
        return

    # Normal Query Processing
    session_id = cl.user_session.get("session_id")
    user_id = cl.user_session.get("user_id")
    history = cl.user_session.get("conversation_history", [])

    try:
        init_response = await asyncio.to_thread(
            requests.post,
            API_URL,
            json={
                "query": user_query,
                "session_id": session_id,
                "user_id": user_id,
                "conversation_history": history,
            },
            timeout=15
        )
        init_response.raise_for_status()
        init_data = init_response.json()
        query_id = init_data.get("query_id")
    except Exception as e:
        err_html = f"""<div class="acaicia-error-card">
<div class="acaicia-error-header">⚠️ Connection Error</div>
<div class="acaicia-error-body">Failed to connect to backend: <pre style="margin-top:8px;">{e}</pre></div>
</div>"""
        await cl.Message(content=err_html, author="acAIcia").send()
        return

    status_url = API_URL.replace("/query", f"/query/status/{query_id}")
    max_polls = 120
    answer = None
    sources = []
    error_message = None
    is_cache_hit = False

    phrase = random.choice(THINKING_PHRASES)
    thinking_html = f"""<div class="acaicia-thinking-inline">
<div class="acaicia-thinking-dots"><span></span><span></span><span></span></div>
<span class="acaicia-thinking-msg">🌿 {phrase}</span>
</div>"""
    thinking_msg = cl.Message(content=thinking_html, author="acAIcia")
    await thinking_msg.send()

    try:
        async with cl.Step(name="acAIcia Multi-Agent Pipeline", type="run") as step:
            for poll_idx in range(max_polls):
                if poll_idx % 4 == 0 and poll_idx > 0:
                    phrase = random.choice(THINKING_PHRASES)
                    thinking_msg.content = f"""<div class="acaicia-thinking-inline"><div class="acaicia-thinking-dots"><span></span><span></span><span></span></div><span class="acaicia-thinking-msg">🌿 {phrase}</span></div>"""
                    await thinking_msg.update()

                step.output = f"🌿 {phrase}"
                await step.update()

                try:
                    status_res = await asyncio.to_thread(requests.get, status_url, timeout=10)
                    if status_res.status_code == 200:
                        status_data = status_res.json()
                        if status_data.get("status") == "completed":
                            answer = status_data.get("response", "No response generated.")
                            sources = status_data.get("sources", [])
                            is_cache_hit = status_data.get("cache_hit", False)
                            step.output = "Execution complete."
                            break
                        elif status_data.get("status") == "failed":
                            raise Exception(status_data.get("error", "Unknown processing error."))
                except Exception as poll_err:
                    if "failed" in str(poll_err).lower():
                        raise poll_err
                await asyncio.sleep(1.5)
    except Exception as e:
        error_message = str(e)

    try:
        await cl.Message(id=thinking_msg.id, content="").remove()
    except Exception:
        pass

    if error_message:
        await cl.Message(content=f"⚠️ Error: {error_message}", author="acAIcia").send()
        return

    if answer is None:
        await cl.Message(content="⚠️ Request timed out.", author="acAIcia").send()
        return

    response_content = answer
    if is_cache_hit:
        response_content = "⚡ *(Fast Cache Hit)*\n\n" + response_content

    if sources:
        citations_html = "\n\n<div class='source-container'><div class='source-header-title'>🌿 Sources & Citations</div>"
        for idx, src in enumerate(sources):
            title = src.get('title', 'Unknown Title')
            authors = src.get('authors', 'Unknown Authors')
            year = src.get('year', 'n.d.')
            doi = src.get('doi', '')
            url = src.get('url', '')
            doi_link = f"<a href='https://doi.org/{doi}' target='_blank'>DOI: {doi}</a>" if doi else ""
            url_link = f"<a href='{url}' target='_blank'>Reference Link</a>" if url else ""
            links = " | ".join(filter(None, [doi_link, url_link]))
            citations_html += f"""
<div class='source-item'>
    <div class='source-title'>[{idx+1}] {title}</div>
    <div class='source-authors'><i>Authors:</i> {authors} ({year})</div>
    <div class='source-links'>{links}</div>
</div>"""
        citations_html += "</div>"
        response_content += citations_html

    # Send response with upvote/downvote action buttons attached!
    actions = [
        cl.Action(name="upvote", value=query_id, label="👍 Useful"),
        cl.Action(name="downvote", value=query_id, label="👎 Needs Work")
    ]
    await cl.Message(content=response_content, author="acAIcia", actions=actions).send()

    history = cl.user_session.get("conversation_history", [])
    history.append({"role": "user", "content": user_query})
    history.append({"role": "assistant", "content": answer})
    cl.user_session.set("conversation_history", history[-10:])
