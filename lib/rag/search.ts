import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentFilename: string;
  chunkText: string;
  similarity: number;
};

type MatchDocumentChunksRow = {
  chunk_id: string;
  document_id: string;
  document_filename: string;
  chunk_text: string;
  similarity: number;
};

const DEFAULT_TOP_K = 5;

// Embeds the question, then delegates the actual similarity search to the
// match_document_chunks() Postgres function (supabase/migrations/
// 0003_rag_and_conversation_history.sql) — a plain supabase-js .select()
// can't order by pgvector distance or join documents in the same query.
// Scoped to sessionId's own ready documents only; never crosses sessions.
export async function searchDocumentChunks(
  supabase: SupabaseClient,
  sessionId: string,
  queryText: string,
  topK: number = DEFAULT_TOP_K,
): Promise<RetrievedChunk[]> {
  const provider = getEmbeddingProvider();
  const [queryEmbedding] = await provider.embed([queryText]);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_session_id: sessionId,
    match_count: topK,
  });

  if (error) {
    throw new Error(`Vector similarity search failed: ${error.message}`);
  }

  return ((data as MatchDocumentChunksRow[]) ?? []).map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    documentFilename: row.document_filename,
    chunkText: row.chunk_text,
    similarity: row.similarity,
  }));
}
