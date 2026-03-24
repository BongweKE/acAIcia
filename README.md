# acAIcia

CIFOR-ICRAF Knowledge Base AI Assistant. 

## Project Architecture
* **Database**: Supabase + PostgreSQL + `pgvector`
* **Ingestion Script**: Python CLI (PyMuPDF, LangChain, Google AI Studio Embeddings)
* **Backend**: Multi-Agent FastAPI App deployed on [Modal](https://modal.com/)
* **Frontend**: Minimalist Streamlit Community app adhering to CIFOR-ICRAF branding

## Deployment Instructions

### 1. Database Setup
1. Create a [Supabase](https://supabase.com/) project.
2. Go to the SQL Editor and execute the script in `database/schema.sql`.

### 2. GPU Data Ingestion (Modal)
Put your `.pdf`, `.md`, `.docx`, and `.pptx` files in `ingestion/data/` (create this folder if it doesn't exist).
The local system only requires the `modal` CLI to securely push these files to the persistent cloud volume.
```bash
cd ingestion
pip install -r requirements.txt
python upload.py
```
This script cleanly uploads your documents and triggers the remote GPU cloud worker (`ingestion/app.py`), which natively chunks the documents and extracts localized HuggingFace embeddings (`BAAI/bge-base-en-v1.5`) from its VRAM before inserting them into Supabase.

### 3. Modal Backend Setup & Installation

First, install the Modal Python client. This package includes both the SDK for writing the multi-agent pipeline and the CLI tools for deployment.

```bash
pip install modal
```

Next, authenticate your terminal with your Modal account. This command will open a browser window to verify your identity and automatically write the token to the `~/.modal.toml` configuration file.

```bash
modal setup
```
*(If the browser does not open automatically, you can generate a token manually via the Modal dashboard and run `modal token set --token-id <id> --token-secret <secret>`)*.

### 4. Managing Backend Secrets

For the acAIcia backend to securely access the CIFOR-ICRAF Supabase database and the Google AI Studio APIs without hardcoding keys, you must store them in Modal's remote Secrets manager. Modal injects these into your cloud containers at runtime.

Create a secret for the database connection. Use the `service_role` key obtained from your Supabase interface:

```bash
modal secret create acaicia-db-secrets \
    SUPABASE_URL="https://your-project-ref.supabase.co" \
    SUPABASE_KEY="your-service-role-key"
```

Create a separate secret for the Google AI Studio API key used by the embedding, guardian, and synthesis agents:

```bash
modal secret create acaicia-llm-secrets \
    GOOGLE_API_KEY="your-google-ai-studio-key"
```

You can verify that your secrets were published successfully by listing them:

```bash
modal secret list
```

### 5. Running and Testing Locally

When writing the FastAPI backend, you will want to test the multi-agent pipeline iteratively. Modal provides a command that executes your code in the cloud while streaming logs back to your local terminal and watching your local files for changes. 

Navigate to the directory containing your backend Python file and run:

```bash
cd backend
modal serve app.py
```
This provisions an ephemeral web endpoint. You can interact with your FastAPI routes via the provided URL to test the agent steps. Every time you save a change to `app.py`, the Modal container will automatically reload.

### 6. Production Deployment

Once the query functionality, safety checks, and relevance gating are thoroughly tested, deploy the backend permanently. 

```bash
modal deploy app.py
```
This command builds the final container image, assigns a persistent URL to your FastAPI endpoint, and leaves it running in the cloud, ready to be connected to the Streamlit UI. 

### 7. Monitoring and Debugging

To check the status of your running apps or view logs directly from the terminal without opening the Modal web dashboard, you can use:

```bash
# List all active deployed applications
modal app list

# Stream logs for a specific deployed app
modal app logs acaicia-backend
``` 

If an agent behaves unexpectedly and you need to inspect the container environment interactively (for example, to check if a specific pip package installed correctly):

```bash
modal shell app.py
```
This opens an interactive `bash` shell directly inside the cloud container equipped with your exact image and attached secrets.

### 8. Running the Frontend (Streamlit)
Update the `BACKEND_URL` variable in `frontend/app.py` with your newly provided Modal API endpoint from Step 6.
```bash
cd frontend
pip install -r requirements.txt
streamlit run app.py
```

### Agents Pipeline
1. **Guardian Agent**: Restricts questions structurally irrelevant to agriculture, forestry, climate change, etc.
2. **Architect Agent**: Refines user inquiry for optimized vector lookup constraints.
3. **Retrieval**: Performs HNSW indexing cosine checks.
4. **Synthesis Agent**: Creates an academically structured answer citing sources.
