-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create the documents catalog table
create table if not exists documents_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text[],
  publication_year integer,
  topic_keywords text[],
  url_link text,
  doi text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the document embeddings table
create table if not exists document_embeddings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents_catalog(id) on delete cascade not null,
  chunk_text text not null,
  embedding vector(768) not null, -- BAAI/bge-base-en-v1.5 has 768 dimensions
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create an HNSW index to speed up vector similarity search
create index on document_embeddings using hnsw (embedding vector_cosine_ops);

-- Create an RPC function to perform the vector search
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  chunk_text text,
  title text,
  authors text[],
  publication_year integer,
  url_link text,
  doi text,
  similarity float
)
language sql stable
as $$
  select
    e.id,
    e.document_id,
    e.chunk_text,
    c.title,
    c.authors,
    c.publication_year,
    c.url_link,
    c.doi,
    1 - (e.embedding <=> query_embedding) as similarity
  from document_embeddings e
  join documents_catalog c on e.document_id = c.id
  where 1 - (e.embedding <=> query_embedding) > match_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Create ingestion logs table
create table if not exists ingestion_logs (
  log_id uuid primary key default gen_random_uuid(),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  filename text not null,
  chunks_created integer,
  status text not null,
  error_message text
);

-- Create query interaction logs table
create table if not exists query_interaction_logs (
  log_id uuid primary key default gen_random_uuid(),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  session_id text,
  original_query text not null,
  guardian_passed boolean not null,
  architect_query text,
  retrieved_doc_ids uuid[],
  synthesis_source text,
  total_tokens_used integer,
  latency_ms integer
);
