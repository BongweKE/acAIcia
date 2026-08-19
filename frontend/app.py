import os
import secrets

# Dynamically generate a secure random 32-byte hex JWT secret if not provided in environment
if not os.environ.get("CHAINLIT_AUTH_SECRET"):
    os.environ["CHAINLIT_AUTH_SECRET"] = secrets.token_hex(32)

import asyncio
import random
import uuid
import requests
import chainlit as cl
from chainlit.input_widget import Select, TextInput
from pathlib import Path

# Constants
BACKEND_URL = "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/query"

API_URL = os.environ.get("BACKEND_URL", BACKEND_URL)
SETTINGS_URL = API_URL.replace("/query", "/settings")
USER_SETTINGS_URL = API_URL.replace("/query", "/user/settings")
FEEDBACK_URL = API_URL.replace("/query", "/feedback")
ADMIN_METRICS_URL = API_URL.replace("/query", "/admin/metrics")
PROMPT_PILLS_URL = API_URL.replace("/query", "/prompt_pills")

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

# Authentication Callback for Sign In / Sign Up
@cl.password_auth_callback
def auth_callback(username, password):
    if username and password:
        role = "admin" if username.lower() in ["b.obaga@landscapealliance.org", "admin"] else "researcher"
        return cl.User(identifier=username, metadata={"role": role, "provider": "supabase"})
    return None

@cl.on_chat_start
async def start():
    user = cl.user_session.get("user")
    is_authenticated = user is not None
    user_identifier = user.identifier if user else "Guest Researcher"
    session_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4()) if not user else user.identifier
    
    cl.user_session.set("session_id", session_id)
    cl.user_session.set("user_id", user_id)
    cl.user_session.set("is_authenticated", is_authenticated)
    cl.user_session.set("guest_query_count", 0)
    cl.user_session.set("conversation_history", [])

    provider_name = "modal" if not is_authenticated else "gemini"

    # Fetch Dynamic Prompt Pills from backend cron DB
    sample_pills = [
        "What percentage of Ghana anthropogenic GHG emissions come from food systems?",
        "Outline indigenous agroforestry plants in Kenya and suitable soil profiles.",
        "What are key policy recommendations for peatland restoration in Southeast Asia?",
        "How do shade-grown coffee systems impact soil organic carbon sequestration?"
    ]
    try:
        p_res = await asyncio.to_thread(requests.get, PROMPT_PILLS_URL, timeout=5)
        if p_res.status_code == 200 and p_res.json().get("pills"):
            sample_pills = p_res.json()["pills"][:4]
    except Exception:
        pass

    # Top Navigation Header Bar
    nav_header_html = f"""<div class="acaicia-top-nav">
<div class="acaicia-nav-brand">
  <svg class="acaicia-nav-logo" viewBox="0 0 100 100" width="32" height="32">
    <g class="acacia-fill"><ellipse cx="50" cy="30" rx="36" ry="7"/><ellipse cx="32" cy="38" rx="22" ry="6"/><ellipse cx="68" cy="38" rx="22" ry="6"/></g>
  </svg>
  <span class="acaicia-nav-title">acAIcia</span>
</div>
<div class="acaicia-nav-links">
  <span class="acaicia-nav-item">Home</span>
  <span class="acaicia-nav-item">About</span>
  <span class="acaicia-nav-item">Publications</span>
  <span class="acaicia-nav-item">FAQs</span>
  <span class="acaicia-nav-item">Contact</span>
</div>
<div class="acaicia-nav-auth">
  <span class="acaicia-nav-auth-btn">👤 {user_identifier} ({'Unlimited' if is_authenticated else 'Guest: 20 queries max'})</span>
</div>
</div>"""

    welcome_html = nav_header_html + f"""<div class="acaicia-welcome-card">
<div class="acaicia-welcome-header">
<div class="acaicia-title-container">
<h1 class="acaicia-title">acAIcia Research Assistant</h1>
<p class="acaicia-subtitle">Intelligent evidence synthesis from Landscape Alliance, CIFOR & ICRAF scientific literature</p>
</div>
</div>
<div class="acaicia-info-card">
<p class="acaicia-info-text">Explore forestry, agroforestry, climate change, peatlands, food systems, and land rights publications. Type a question below or select a sample topic:</p>
</div>
<div class="acaicia-pills-grid">
  <div class="acaicia-pill-item">🌿 {sample_pills[0]}</div>
  <div class="acaicia-pill-item">🌱 {sample_pills[1]}</div>
  <div class="acaicia-pill-item">🍃 {sample_pills[2] if len(sample_pills)>2 else sample_pills[0]}</div>
  <div class="acaicia-pill-item">🌴 {sample_pills[3] if len(sample_pills)>3 else sample_pills[1]}</div>
</div>
</div>"""

    await cl.Message(content=welcome_html, author="acAIcia").send()

    # Footer Section
    footer_html = """<div class="acaicia-footer">
<p>© 2026 Landscape Alliance. All rights reserved. CIFOR-ICRAF Scientific Research Platform.</p>
</div>"""
    footer_msg = cl.Message(content=footer_html, author="acAIcia")
    await footer_msg.send()
    cl.user_session.set("temp_footer_id", footer_msg.id)

    # Chat Settings: Guests get Modal Gemma only; Authenticated get provider choices
    if is_authenticated:
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
    is_authenticated = cl.user_session.get("is_authenticated", False)
    if not is_authenticated:
        await cl.Message(content="🔒 Guest accounts use **Modal Gemma 4**. Sign in to select custom LLM providers.", author="acAIcia").send()
        return

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

@cl.action_callback("upvote")
async def on_upvote(action: cl.Action):
    log_id = action.payload.get("value") if isinstance(action.payload, dict) else (action.value or "")
    user_id = cl.user_session.get("user_id")
    try:
        await asyncio.to_thread(requests.post, FEEDBACK_URL, json={"log_id": log_id, "user_id": user_id, "rating": 1}, timeout=5)
        await cl.Message(content="👍 *Thank you for your feedback!*", author="acAIcia").send()
    except Exception as e:
        await cl.Message(content=f"⚠️ Error sending feedback: {e}", author="acAIcia").send()

@cl.action_callback("downvote")
async def on_downvote(action: cl.Action):
    log_id = action.payload.get("value") if isinstance(action.payload, dict) else (action.value or "")
    user_id = cl.user_session.get("user_id")
    try:
        await asyncio.to_thread(requests.post, FEEDBACK_URL, json={"log_id": log_id, "user_id": user_id, "rating": -1}, timeout=5)
        await cl.Message(content="👎 *Thank you for your feedback. We logged this response for quality evaluation.*", author="acAIcia").send()
    except Exception as e:
        await cl.Message(content=f"⚠️ Error sending feedback: {e}", author="acAIcia").send()

@cl.on_message
async def main(message: cl.Message):
    user_query = message.content.strip()
    is_authenticated = cl.user_session.get("is_authenticated", False)
    guest_count = cl.user_session.get("guest_query_count", 0)

    # 1. Navigation Command: /about
    if user_query.lower() == "/about":
        about_html = """<div class="acaicia-modal-card">
<h2 class="acaicia-modal-title">🌿 About <span>acAIcia & Landscape Alliance</span></h2>
<p><b>acAIcia</b> is an autonomous multi-agent Retrieval-Augmented Generation (RAG) system built for the <b>Landscape Alliance (CIFOR-ICRAF)</b>.</p>
<p>It aggregates, chunks, vectorizes, and indexes peer-reviewed research papers, policy briefs, and technical documents spanning tropical forestry, agroforestry, soil science, peatland hydrology, food systems, and land governance.</p>
<p><b>Core Pipeline Architecture:</b></p>
<ul>
  <li><b>Guardian Agent:</b> Filters queries to ensure scientific domain alignment.</li>
  <li><b>Architect Agent:</b> Preserves technical entities, DOIs, and geographic coordinates.</li>
  <li><b>Hybrid Retrieval (RRF):</b> Combines vector similarity with full-text BM25 keyword matching.</li>
  <li><b>Synthesis Agent:</b> Generates answers with strict <code>[Author(s), Year]</code> inline citations.</li>
</ul>
</div>"""
        await cl.Message(content=about_html, author="acAIcia").send()
        return

    # 2. Navigation Command: /faqs
    if user_query.lower() == "/faqs":
        faqs_html = """<div class="acaicia-modal-card">
<h2 class="acaicia-modal-title">❓ Frequently Asked Questions (FAQs)</h2>
<div class="acaicia-faq-item">
  <h4>Q: What literature sources does acAIcia cover?</h4>
  <p>A: Peer-reviewed publications, working papers, and technical reports from CIFOR-ICRAF and the Landscape Alliance knowledge base.</p>
</div>
<div class="acaicia-faq-item">
  <h4>Q: What are the guest query limits?</h4>
  <p>A: Guest users receive 20 free research queries per browser session. Registered accounts enjoy unlimited queries, multi-device history, and custom instructions.</p>
</div>
<div class="acaicia-faq-item">
  <h4>Q: How does citation verification work?</h4>
  <p>A: Every factual statement is backed by retrieved chunks and formatted as <code>[Author, Year]</code> with direct links to publication DOIs.</p>
</div>
</div>"""
        await cl.Message(content=faqs_html, author="acAIcia").send()
        return

    # 3. Navigation Command: /blogs or /publications
    if user_query.lower() in ["/blogs", "/publications"]:
        blogs_html = """<div class="acaicia-modal-card">
<h2 class="acaicia-modal-title">📚 Featured Publications & Policy Briefs</h2>
<div class="acaicia-faq-item">
  <h4>Opportunities for a low-emission transformation of Ghana's food systems (2026)</h4>
  <p>Authors: Bohne, S., Martius, C., Pingault, N. | DOI: 10.17528/cifor-icraf/009417</p>
</div>
<div class="acaicia-faq-item">
  <h4>Towards low-emission food systems in Ghana: A country profile (2025)</h4>
  <p>Authors: Pingault, N., Martius, C. | DOI: 10.17528/cifor-icraf/009412</p>
</div>
</div>"""
        await cl.Message(content=blogs_html, author="acAIcia").send()
        return

    # 4. Navigation Command: /contact
    if user_query.lower() == "/contact":
        contact_html = """<div class="acaicia-modal-card">
<h2 class="acaicia-modal-title">📬 Contact & Institutional Research Enquiries</h2>
<p>For research collaborations, dataset additions, or platform support, please contact the Landscape Alliance research team:</p>
<p>📧 <b>General Enquiries:</b> <code>info@acaicia.org</code></p>
<p>👤 <b>Site Administrator:</b> <code>b.obaga@landscapealliance.org</code></p>
<p>🌐 <b>Institutional Website:</b> <a href="https://www.landscapealliance.org/knowledge/publications/" target="_blank">Landscape Alliance Knowledge Library</a></p>
</div>"""
        await cl.Message(content=contact_html, author="acAIcia").send()
        return

    # 5. Command: /login
    if user_query.lower() in ["/login", "/register", "login", "sign in"]:
        auth_html = """<div class="acaicia-modal-card">
<h2 class="acaicia-modal-title">🔐 Researcher Sign In / Registration</h2>
<p>Sign in to unlock unlimited research queries, persistent multi-device conversation sync in Supabase, and custom research preferences.</p>
<p style="color:#00e65c;">Click the <b>Sign In / Sign Up</b> link in the top right header to authenticate.</p>
</div>"""
        await cl.Message(content=auth_html, author="acAIcia").send()
        return

    # 6. Command: User Settings UI
    if user_query.lower() == "/settings":
        settings_html = f"""<div class="acaicia-settings-card">
<div class="acaicia-settings-header">
<h2 class="acaicia-settings-title">User <span>Settings & Profile</span></h2>
</div>
<div class="acaicia-settings-form-group">
<label class="acaicia-settings-label">Account Status</label>
<p style="color:#a3bca7; margin:0 0 10px 0;">{'Authenticated Researcher' if is_authenticated else 'Guest Researcher (20 queries max)'}</p>
</div>
<div class="acaicia-settings-form-group">
<label class="acaicia-settings-label">What preferences should acAIcia consider in responses?</label>
<p style="color:#8fa794; font-size:0.88rem; margin:4px 0 8px 0;">acAIcia will keep this custom instruction in mind across chats (e.g. <i>"Focus on East Africa agroforestry policy briefs"</i>)</p>
</div>
<p style="color:#00e65c;">To update your custom research instructions, type: <code>/set_instructions [your custom instructions here]</code></p>
</div>"""
        await cl.Message(content=settings_html, author="acAIcia").send()
        return

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

    # 7. Special Command: Admin Metrics Dashboard
    if user_query.lower() == "/admin":
        user = cl.user_session.get("user")
        is_admin = user and user.metadata.get("role") == "admin"
        if not is_admin:
            await cl.Message(content="🔒 **Access Restricted:** The `/admin` dashboard requires an authorized admin account (`b.obaga@landscapealliance.org`).", author="acAIcia").send()
            return
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

    # Check Guest Query Limit (20 Max)
    if not is_authenticated:
        guest_count += 1
        cl.user_session.set("guest_query_count", guest_count)
        if guest_count > 20:
            limit_html = """<div class="acaicia-modal-card" style="border-left: 4px solid #ff4d4d;">
<h2 class="acaicia-modal-title" style="color:#ff4d4d;">🌿 Guest Query Limit Reached (20/20)</h2>
<p>You have used all <b>20 free guest queries</b> in this browser session.</p>
<p>Please <b>Sign In</b> or <b>Create a Free Account</b> to continue asking questions, save conversation history across devices, and set custom research preferences.</p>
<p style="color:#00e65c;">Click <b>Sign In / Sign Up</b> in the header bar to continue.</p>
</div>"""
            await cl.Message(content=limit_html, author="acAIcia").send()
            return

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
    
    response_msg = cl.Message(content=thinking_html, author="acAIcia")
    await response_msg.send()

    try:
        async with cl.Step(name="acAIcia Multi-Agent Pipeline", type="run") as step:
            for poll_idx in range(max_polls):
                if poll_idx % 4 == 0 and poll_idx > 0:
                    phrase = random.choice(THINKING_PHRASES)
                    response_msg.content = f"""<div class="acaicia-thinking-inline"><div class="acaicia-thinking-dots"><span></span><span></span><span></span></div><span class="acaicia-thinking-msg">🌿 {phrase}</span></div>"""
                    await response_msg.update()

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

    if error_message:
        response_msg.content = f"⚠️ Error: {error_message}"
        await response_msg.update()
        return

    if answer is None:
        response_msg.content = "⚠️ Request timed out."
        await response_msg.update()
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

    response_msg.content = response_content
    response_msg.actions = [
        cl.Action(name="upvote", value=query_id, payload={"value": query_id}, label="👍 Useful"),
        cl.Action(name="downvote", value=query_id, payload={"value": query_id}, label="👎 Needs Work")
    ]
    await response_msg.update()

    history = cl.user_session.get("conversation_history", [])
    history.append({"role": "user", "content": user_query})
    history.append({"role": "assistant", "content": answer})
    cl.user_session.set("conversation_history", history[-10:])
