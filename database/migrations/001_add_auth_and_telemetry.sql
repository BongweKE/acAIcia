-- ============================================================================
-- Migration: 001_add_auth_and_telemetry.sql
-- Description: Adds user profiles, persistent user chat history, granular
--              telemetry, chunk ranking logs, in-chat feedback, semantic cache,
--              evaluation runs tracking, and hybrid RRF search.
-- ============================================================================

-- Ensure pgvector extension is available
create extension if not exists vector;

-- 1. User Profiles & Preferences Table
create table if not exists user_profiles (
  user_id uuid primary key default gen_random_uuid(),
  email text unique,
  full_name text,
  preferred_name text,
  work_description text,
  custom_instructions text,
  avatar_url text,
  theme text default 'forest_dark',
  language text default 'en',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Default system guest user profile if needed
insert into user_profiles (user_id, email, full_name, preferred_name, work_description, custom_instructions)
values ('00000000-0000-0000-0000-000000000000'::uuid, 'guest@acaicia.org', 'Guest Researcher', 'Guest', 'Independent Researcher', '')
on conflict (user_id) do nothing;

-- 2. User Conversations & Messages (Persistent History for Logged-In Users)
create table if not exists conversations (
  conversation_id uuid primary key default gen_random_uuid(),
  user_id uuid references user_profiles(user_id) on delete cascade,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists conversation_messages (
  message_id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(conversation_id) on delete cascade,
  role text check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enhanced Telemetry Columns in query_interaction_logs
alter table query_interaction_logs add column if not exists user_id uuid;
alter table query_interaction_logs add column if not exists search_mode text default 'hybrid';
alter table query_interaction_logs add column if not exists cache_hit boolean default false;
alter table query_interaction_logs add column if not exists guardian_ms integer;
alter table query_interaction_logs add column if not exists architect_ms integer;
alter table query_interaction_logs add column if not exists retrieval_ms integer;
alter table query_interaction_logs add column if not exists synthesis_ms integer;

-- 4. Chunk Ranking Telemetry Table
create table if not exists query_chunk_logs (
  id uuid primary key default gen_random_uuid(),
  log_id uuid references query_interaction_logs(log_id) on delete cascade,
  chunk_id uuid references document_embeddings(id) on delete cascade,
  vector_rank integer,
  vector_score float,
  text_rank integer,
  text_score float,
  rrf_score float,
  final_rank integer not null
);

-- 5. In-Chat Response Feedback Table
create table if not exists query_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  log_id uuid references query_interaction_logs(log_id) on delete cascade,
  user_id uuid,
  rating integer check (rating in (-1, 1)),
  correction_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Semantic Response Cache Table
create table if not exists semantic_cache (
  cache_id uuid primary key default gen_random_uuid(),
  query_text text not null,
  query_embedding vector(768) not null,
  response_text text not null,
  sources jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create HNSW index for fast semantic cache lookup
create index if not exists semantic_cache_idx on semantic_cache using hnsw (query_embedding vector_cosine_ops);

-- Semantic Cache Vector Similarity Match Function
create or replace function match_semantic_cache (
  query_embedding vector(768),
  match_threshold float default 0.95
)
returns table (
  cache_id uuid,
  query_text text,
  response_text text,
  sources jsonb,
  similarity float
)
language sql stable
as $$
  select
    c.cache_id,
    c.query_text,
    c.response_text,
    c.sources,
    1 - (c.query_embedding <=> query_embedding) as similarity
  from semantic_cache c
  where 1 - (c.query_embedding <=> query_embedding) >= match_threshold
  order by c.query_embedding <=> query_embedding
  limit 1;
$$;

-- 7. Evaluation Runs Tracking Table
create table if not exists evaluation_runs (
  run_id uuid primary key default gen_random_uuid(),
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  dataset_name text not null,
  num_questions integer not null,
  hit_rate_at_5 float not null,
  context_precision float not null,
  avg_latency_ms float not null,
  model_provider text not null,
  details jsonb
);

-- 8. Hybrid Retrieval RPC Function (Reciprocal Rank Fusion)
create or replace function match_documents_hybrid (
  query_text text,
  query_embedding vector(768),
  match_count int default 5,
  rrf_k int default 60
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
  rrf_score float
)
language sql stable
as $$
  with vector_matches as (
    select e.id, row_number() over (order by e.embedding <=> query_embedding) as rank
    from document_embeddings e
    order by e.embedding <=> query_embedding
    limit 20
  ),
  text_matches as (
    select e.id, row_number() over (order by ts_rank(to_tsvector('english', e.chunk_text), websearch_to_tsquery('english', query_text)) desc) as rank
    from document_embeddings e
    where to_tsvector('english', e.chunk_text) @@ websearch_to_tsquery('english', query_text)
    limit 20
  ),
  combined as (
    select 
      coalesce(v.id, t.id) as chunk_id,
      coalesce(1.0 / (rrf_k + v.rank), 0.0) + coalesce(1.0 / (rrf_k + t.rank), 0.0) as rrf_score
    from vector_matches v
    full outer join text_matches t on v.id = t.id
  )
  select
    e.id,
    e.document_id,
    e.chunk_text,
    c.title,
    c.authors,
    c.publication_year,
    c.url_link,
    c.doi,
    cb.rrf_score
  from combined cb
  join document_embeddings e on cb.chunk_id = e.id
  join documents_catalog c on e.document_id = c.id
  order by cb.rrf_score desc
  limit match_count;
$$;
