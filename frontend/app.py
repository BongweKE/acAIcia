import streamlit as st
import requests

# Constants
# Replace with the actual deployed URL of your Modal backend
BACKEND_URL = "https://ciforicraf-ai--acaicia-backend-fastapi-app-entrypoint.modal.run/query"

st.set_page_config(
    page_title="acAIcia - CIFOR-ICRAF Research Assistant",
    page_icon="🌿",
    layout="centered"
)

# Fetch settings on load
SETTINGS_URL = BACKEND_URL.replace("/query", "/settings")

@st.cache_data(ttl=10)  # cache settings retrieval briefly
def fetch_settings():
    try:
        response = requests.get(SETTINGS_URL, timeout=10)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        pass
    return None

# Sidebar config
st.sidebar.title("🌿 Admin Control Console")
st.sidebar.markdown("Configure core settings and LLM parameters for acAIcia.")

settings = fetch_settings()

if settings:
    current_provider = settings.get("llm_provider", "gemini")
    
    st.sidebar.subheader("LLM Provider Setup")
    provider_options = {
        "gemini": "Google Gemini API",
        "nvidia": "NVIDIA NIM API",
        "modal": "Modal Gemma 4 (Self-Hosted)"
    }
    
    # Pre-select based on remote configuration
    try:
        provider_index = list(provider_options.keys()).index(current_provider)
    except ValueError:
        provider_index = 0
        
    selected_option = st.sidebar.radio(
        "Active Model Provider",
        options=list(provider_options.keys()),
        format_func=lambda x: provider_options[x],
        index=provider_index
    )
    
    # Save button
    if st.sidebar.button("Apply & Save Settings", use_container_width=True):
        try:
            res = requests.post(SETTINGS_URL, json={"llm_provider": selected_option}, timeout=10)
            if res.status_code == 200:
                st.sidebar.success(f"Successfully switched to {provider_options[selected_option]}!")
                st.cache_data.clear() # clear cache to refetch
                st.rerun()
            else:
                st.sidebar.error(f"Failed to update settings: {res.text}")
        except Exception as e:
            st.sidebar.error(f"Error connecting to settings API: {e}")
            
    st.sidebar.divider()
    st.sidebar.subheader("System Credentials Status")
    st.sidebar.markdown(f"- **Google API Key:** {'✅ Configured' if settings.get('google_api_key_configured') else '❌ Missing'}")
    st.sidebar.markdown(f"- **NVIDIA API Key:** {'✅ Configured' if settings.get('nvidia_api_key_configured') else '❌ Missing'}")
    st.sidebar.markdown(f"- **Hugging Face Token:** {'✅ Configured' if settings.get('hf_token_configured') else '⚠️ Missing (required for Gemma 4)'}")
    st.sidebar.markdown(f"- **Active Configuration Source:** `{settings.get('active_source', 'default')}`")
else:
    st.sidebar.warning("Could not fetch remote configuration from backend settings API. Operating with fallback default provider.")

st.title("acAIcia")
st.subheader("CIFOR-ICRAF Expert Research Assistant")
st.markdown("Ask questions related to forestry, agroforestry, climate change, and CIFOR-ICRAF research.")

# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat history
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if "sources" in message and message["sources"]:
            with st.expander("Sources & Citations"):
                for idx, src in enumerate(message["sources"]):
                    title = src.get('title', 'Unknown Title')
                    authors = src.get('authors', 'Unknown Authors')
                    year = src.get('year', 'n.d.')
                    doi = src.get('doi', '')
                    url = src.get('url', '')
                    
                    st.markdown(f"**[{idx+1}] {title}**")
                    st.markdown(f"*Authors:* {authors} ({year})")
                    if doi:
                        st.markdown(f"**DOI:** [{doi}](https://doi.org/{doi})")
                    if url:
                        st.markdown(f"**URL:** [{url}]({url})")
                    st.divider()

# Accept user input
if prompt := st.chat_input("Ask acAIcia a question..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    
    # Display user message in chat message container
    with st.chat_message("user"):
        st.markdown(prompt)

    # Display assistant response in chat message container
    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        message_placeholder.markdown("acAIcia is thinking...")
        
        try:
            response = requests.post(
                BACKEND_URL,
                json={"query": prompt},
                timeout=60 # Generative AI response might take time
            )
            response.raise_for_status()
            data = response.json()
            
            answer = data.get("response", "No response generated.")
            sources = data.get("sources", [])
            
            message_placeholder.markdown(answer)
            
            if sources:
                with st.expander("Sources & Citations"):
                    for idx, src in enumerate(sources):
                        title = src.get('title', 'Unknown Title')
                        authors = src.get('authors', 'Unknown Authors')
                        year = src.get('year', 'n.d.')
                        doi = src.get('doi', '')
                        url = src.get('url', '')
                        
                        st.markdown(f"**[{idx+1}] {title}**")
                        st.markdown(f"*Authors:* {authors} ({year})")
                        if doi:
                            st.markdown(f"**DOI:** [{doi}](https://doi.org/{doi})")
                        if url:
                            st.markdown(f"**URL:** [{url}]({url})")
                        st.divider()
                        
            st.session_state.messages.append({
                "role": "assistant", 
                "content": answer,
                "sources": sources
            })
            
        except Exception as e:
            error_msg = f"An error occurred while connecting to the backend: {e}"
            message_placeholder.error(error_msg)
            # We don't append errors to chat history typically, or we can
