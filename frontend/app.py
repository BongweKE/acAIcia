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
