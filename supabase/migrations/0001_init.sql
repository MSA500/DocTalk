-- DocTalk Phase 2 — documents + document_chunks schema.
--
-- No auth/user tables: documents are scoped by an anonymous `session_id`
-- (a UUID stored in a cookie, see lib/session-cookie.ts), not a user_id.
-- Conversation history (Phase 3) will be scoped the same way and stays
-- global per session rather than per-document, so it is intentionally not
-- referenced from this schema.
--
-- Embedding dimension is fixed at 384 to match the default embedding model
-- (sentence-transformers/all-MiniLM-L6-v2 via Hugging Face). Switching to a
-- provider/model with a different output dimension requires a migration
-- that alters document_chunks.embedding — the embedding *provider* is
-- swappable via env vars alone (see lib/ai/embeddings.ts), but the vector
-- column's fixed width is an inherent pgvector constraint, not something
-- the adapter pattern can abstract away.
--
-- documents.status is a real pipeline stage, not just "pending/done":
--   uploading   -> raw file is being received and written to Storage
--   extracting  -> pdf-parse/mammoth/plain-read pulling text out of the file
--   embedding   -> chunking + generating/storing vector embeddings
--   ready       -> chunks are stored and searchable
--   failed      -> see error_message for which stage failed and why
-- The client polls GET /api/documents/[id] to reflect these transitions in
-- real time (see app/api/documents/upload and .../[id]/process).

create extension if not exists vector with schema extensions;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  filename text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'txt')),
  size_bytes bigint not null check (size_bytes > 0),
  storage_path text not null,
  status text not null default 'uploading' check (status in ('uploading', 'extracting', 'embedding', 'ready', 'failed')),
  error_message text,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_session_id_idx on documents (session_id);
create index if not exists documents_status_idx on documents (status);
create index if not exists documents_session_created_idx on documents (session_id, created_at desc);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding vector(384),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists document_chunks_document_id_idx on document_chunks (document_id);

-- HNSW is safe to build immediately (unlike ivfflat, it doesn't need
-- existing rows to pick good parameters) and is the current recommended
-- default for pgvector similarity search.
create index if not exists document_chunks_embedding_hnsw_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on documents;
create trigger documents_set_updated_at
  before update on documents
  for each row
  execute function set_updated_at();

-- No client (anon/authenticated) access is expected — every read/write goes
-- through Next.js API routes using the service_role key, which bypasses RLS
-- by design. Enabling RLS with zero policies here is defense-in-depth: if
-- the anon key ever leaks, it still can't touch these tables directly.
alter table documents enable row level security;
alter table document_chunks enable row level security;

-- Private bucket for raw uploaded files. No storage policies are added for
-- the same reason as above: only the service_role client (server-side)
-- touches this bucket, and a private bucket with no policies already
-- denies anon/authenticated access by default.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
