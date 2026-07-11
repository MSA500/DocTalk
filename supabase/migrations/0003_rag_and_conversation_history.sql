-- DocTalk Phase 3 — vector search RPC, global conversation history, and
-- voice-call token mapping.
--
-- match_document_chunks(): the actual similarity search. A plain
-- supabase-js .select() can't order by pgvector distance or join across
-- documents/document_chunks in one query, so this is exposed as a
-- Postgres function and called via supabase.rpc(). Scoped to one
-- session's own *ready* documents only — a session can never retrieve
-- chunks belonging to another session's documents, and documents still
-- mid-pipeline (uploading/extracting/embedding) or failed are excluded
-- since their chunks are either absent or incomplete.
create or replace function match_document_chunks(
  query_embedding vector(384),
  match_session_id uuid,
  match_count int default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_filename text,
  chunk_text text,
  similarity float
)
language sql
stable
as $$
  select
    dc.id as chunk_id,
    dc.document_id,
    d.filename as document_filename,
    dc.chunk_text,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where d.session_id = match_session_id
    and d.status = 'ready'
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- Global (not per-document) conversation history — every RAG Q&A turn for
-- a session, voice or otherwise, lands here as one row. Not a multi-turn
-- chat thread: each question is answered independently (see lib/rag/), this
-- table only exists so the transcript can be persisted and reloaded when
-- the voice overlay reopens.
create table if not exists conversation_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  question text not null,
  answer text not null,
  referenced_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists conversation_turns_session_created_idx
  on conversation_turns (session_id, created_at);

alter table conversation_turns enable row level security;

-- Vapi's servers call POST /api/vapi/chat/completions directly (server to
-- server — no browser cookies), so the real doctalk-session id can't reach
-- that request as-is, and per lib/session-cookie.ts it's httpOnly by design
-- (no client JS ever reads it). Rather than exposing the real session id to
-- client JS or to Vapi's infrastructure just to thread it through, the
-- client asks POST /api/voice/prepare-call (a same-origin request, so the
-- httpOnly cookie *is* sent) for a short-lived, opaque call_token, embeds
-- only that token in the assistantOverrides URL Vapi is given, and
-- /api/vapi/chat/completions resolves it back to session_id server-side.
-- Tokens aren't explicitly deleted; lookups treat anything older than a few
-- hours as invalid (see lib/rag/call-token.ts), which is enough at this
-- scale without needing a scheduled cleanup job.
create table if not exists voice_call_tokens (
  call_token uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  created_at timestamptz not null default now()
);

alter table voice_call_tokens enable row level security;
