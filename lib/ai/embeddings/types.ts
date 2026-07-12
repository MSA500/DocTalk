export interface EmbeddingProvider {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export class EmbeddingConfigError extends Error {}

// Must match document_chunks.embedding's fixed width in
// supabase/migrations/0001_init.sql — changing EMBEDDING_PROVIDER/MODEL to a
// different output dimension requires a matching DB migration.
export const EXPECTED_EMBEDDING_DIMENSIONS = 384;
