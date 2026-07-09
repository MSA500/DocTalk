export interface EmbeddingProvider {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export class EmbeddingConfigError extends Error {}

// Must match document_chunks.embedding's fixed width in
// supabase/migrations/0001_init.sql. Swapping EMBEDDING_PROVIDER/MODEL to
// one with a different output dimension requires a matching DB migration —
// see the comment at the top of that file.
export const EXPECTED_EMBEDDING_DIMENSIONS = 384;
