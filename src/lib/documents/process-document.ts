import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadDocumentFile } from "@/lib/documents/storage";
import { extractText, TextExtractionError } from "@/lib/documents/extract-text";
import { chunkText } from "@/lib/documents/chunk-text";
import {
  EmbeddingConfigError,
  EXPECTED_EMBEDDING_DIMENSIONS,
  getEmbeddingProvider,
} from "@/lib/ai/embeddings";
import {
  toDocumentRecord,
  type DocumentRecord,
  type DocumentRow,
  type ProcessingProgress,
} from "@/lib/types/document";

// Large documents (700-1000 pages) generate hundreds of chunks whose
// embeddings can't all be computed within one serverless invocation's time
// limit. Processing is therefore split across many short invocations: one
// extract phase that persists every chunk's text with a NULL embedding, then
// repeated embed phases that each fill in a bounded slice. The NULL-embedding
// rows are the resume state, so an interrupted run continues exactly where it
// left off on the next call. See processDocumentStep below.

const EMBED_CHUNKS_PER_INVOCATION = 96;
const EMBEDDING_BATCH_SIZE = 32;
// Large so a big document's chunk rows insert in few round-trips — the extract
// phase's cost is dominated by per-request latency, not payload size.
const CHUNK_INSERT_BATCH_SIZE = 250;
const MAX_BATCH_RETRIES = 2;
// Hard ceiling on how long one embed invocation keeps starting new batches.
// The embedding API can return *slow but successful* responses under load
// (uninterruptible), so a chunk cap alone isn't enough to guarantee the
// invocation stays under the serverless time limit — this stops before the
// limit and lets the client continue in a fresh invocation. Kept well below
// 60s so even one more in-flight slow batch can't push a call over.
const INVOCATION_TIME_BUDGET_MS = 20_000;

export type ProcessResult = {
  document: DocumentRecord;
  done: boolean;
  retryable?: boolean;
  progress?: ProcessingProgress;
};

type PendingChunk = { id: string; chunk_index: number; chunk_text: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A permanent error won't be fixed by retrying, so the document is failed
// cleanly. Anything else is treated as transient: the document is left
// mid-embedding (resumable) and the caller is told to retry later.
function isPermanentEmbeddingError(err: unknown): boolean {
  if (err instanceof EmbeddingConfigError) return true;
  const message = (err as Error)?.message ?? "";
  return /\b(400|401|403|404|422)\b/.test(message);
}

async function markFailed(
  supabase: SupabaseClient,
  row: DocumentRow,
  message: string,
): Promise<ProcessResult> {
  await supabase.from("document_chunks").delete().eq("document_id", row.id);
  const { data } = await supabase
    .from("documents")
    .update({ status: "failed", error_message: message, chunk_count: 0 })
    .eq("id", row.id)
    .select()
    .single();
  const updated =
    (data as DocumentRow | null) ?? { ...row, status: "failed" as const, error_message: message };
  return { document: toDocumentRecord(updated), done: true };
}

async function countUnembedded(supabase: SupabaseClient, documentId: string): Promise<number> {
  const { count } = await supabase
    .from("document_chunks")
    .select("id", { count: "exact", head: true })
    .eq("document_id", documentId)
    .is("embedding", null);
  return count ?? 0;
}

// First phase: extract text, chunk it, and persist every chunk's text with a
// NULL embedding. Runs once per document; re-running (after a crash) clears
// any partial chunks first so it always produces a clean, complete set.
async function runExtractPhase(supabase: SupabaseClient, row: DocumentRow): Promise<ProcessResult> {
  await supabase
    .from("documents")
    .update({ status: "extracting", error_message: null })
    .eq("id", row.id);

  await supabase.from("document_chunks").delete().eq("document_id", row.id);

  let buffer: Buffer;
  try {
    buffer = await downloadDocumentFile(row.storage_path);
  } catch (err) {
    const message = (err as Error).message ?? "";
    // A genuinely missing object is permanent; a network/timeout blip on a
    // large file download is transient and worth retrying (the phase re-runs
    // from the start on the next call, since no chunks were written yet).
    if (/not found|does not exist|no data returned|\b404\b/i.test(message)) {
      return markFailed(supabase, row, `Could not retrieve the uploaded file: ${message}`);
    }
    return { document: toDocumentRecord(row), done: false, retryable: true };
  }

  let text: string;
  try {
    text = await extractText(buffer, row.file_type);
  } catch (err) {
    const message =
      err instanceof TextExtractionError ? err.message : "Could not extract text from this file.";
    return markFailed(supabase, row, message);
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return markFailed(supabase, row, "No content could be extracted from this file.");
  }

  try {
    // Insert batches concurrently — rows are independent, so wall-time is the
    // slowest single insert rather than the sum, which keeps the extract phase
    // comfortably within the invocation limit even for very large documents.
    const inserts: Promise<void>[] = [];
    for (let i = 0; i < chunks.length; i += CHUNK_INSERT_BATCH_SIZE) {
      const rows = chunks.slice(i, i + CHUNK_INSERT_BATCH_SIZE).map((chunk) => ({
        document_id: row.id,
        chunk_index: chunk.index,
        chunk_text: chunk.text,
      }));
      inserts.push(
        (async () => {
          const { error } = await supabase.from("document_chunks").insert(rows);
          if (error) throw new Error(error.message);
        })(),
      );
    }
    await Promise.all(inserts);
  } catch (err) {
    return markFailed(supabase, row, `Preparing document chunks failed: ${(err as Error).message}`);
  }

  const { data } = await supabase
    .from("documents")
    .update({ status: "embedding", chunk_count: chunks.length })
    .eq("id", row.id)
    .select()
    .single();
  const updated =
    (data as DocumentRow | null) ?? { ...row, status: "embedding" as const, chunk_count: chunks.length };

  return {
    document: toDocumentRecord(updated),
    done: false,
    progress: { total: chunks.length, embedded: 0 },
  };
}

// Continuation phase: embed the next bounded slice of NULL-embedding chunks
// and persist each sub-batch as it completes, so partial progress survives an
// interruption. When no unembedded chunks remain the document is marked ready.
async function runEmbedPhase(supabase: SupabaseClient, row: DocumentRow): Promise<ProcessResult> {
  const { data: pendingData, error: pendingError } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, chunk_text")
    .eq("document_id", row.id)
    .is("embedding", null)
    .order("chunk_index", { ascending: true })
    .limit(EMBED_CHUNKS_PER_INVOCATION);

  if (pendingError) {
    return { document: toDocumentRecord(row), done: false, retryable: true };
  }

  const pending = (pendingData as PendingChunk[]) ?? [];
  if (pending.length === 0) {
    return finalizeReady(supabase, row);
  }

  let provider;
  try {
    provider = getEmbeddingProvider();
  } catch (err) {
    const message =
      err instanceof EmbeddingConfigError ? err.message : "Embedding provider is not configured.";
    return markFailed(supabase, row, message);
  }

  if (provider.dimensions !== EXPECTED_EMBEDDING_DIMENSIONS) {
    return markFailed(
      supabase,
      row,
      `The configured embedding provider produces ${provider.dimensions}-dimension vectors, but the database expects ${EXPECTED_EMBEDDING_DIMENSIONS}.`,
    );
  }

  const startedAt = Date.now();

  for (let i = 0; i < pending.length; i += EMBEDDING_BATCH_SIZE) {
    // Stop starting new batches once the time budget is spent; the client
    // continues from the remaining NULL chunks in a fresh invocation.
    if (i > 0 && Date.now() - startedAt > INVOCATION_TIME_BUDGET_MS) break;

    const batch = pending.slice(i, i + EMBEDDING_BATCH_SIZE);
    let vectors: number[][] | null = null;

    for (let attempt = 0; attempt <= MAX_BATCH_RETRIES; attempt++) {
      try {
        vectors = await provider.embed(batch.map((chunk) => chunk.chunk_text));
        break;
      } catch (err) {
        if (isPermanentEmbeddingError(err)) {
          return markFailed(supabase, row, `Embedding generation failed: ${(err as Error).message}`);
        }
        if (attempt === MAX_BATCH_RETRIES) {
          return { document: toDocumentRecord(row), done: false, retryable: true };
        }
        await delay(800 * (attempt + 1));
      }
    }

    if (!vectors) {
      return { document: toDocumentRecord(row), done: false, retryable: true };
    }

    const { error: upsertError } = await supabase.from("document_chunks").upsert(
      batch.map((chunk, j) => ({
        document_id: row.id,
        chunk_index: chunk.chunk_index,
        chunk_text: chunk.chunk_text,
        embedding: vectors![j],
      })),
      { onConflict: "document_id,chunk_index" },
    );
    if (upsertError) {
      return { document: toDocumentRecord(row), done: false, retryable: true };
    }
  }

  const remaining = await countUnembedded(supabase, row.id);
  if (remaining === 0) {
    return finalizeReady(supabase, row);
  }

  const total = row.chunk_count;
  return {
    document: toDocumentRecord({ ...row, status: "embedding" }),
    done: false,
    progress: { total, embedded: Math.max(0, total - remaining) },
  };
}

async function finalizeReady(supabase: SupabaseClient, row: DocumentRow): Promise<ProcessResult> {
  const { data } = await supabase
    .from("documents")
    .update({ status: "ready" })
    .eq("id", row.id)
    .select()
    .single();
  const updated = (data as DocumentRow | null) ?? { ...row, status: "ready" as const };
  return {
    document: toDocumentRecord(updated),
    done: true,
    progress: { total: updated.chunk_count, embedded: updated.chunk_count },
  };
}

// One bounded unit of work. The client calls this repeatedly (via the
// /process route) until `done` is true. Phase is inferred from chunk_count:
// zero means extraction hasn't completed yet, non-zero means chunks exist and
// only embeddings remain.
export async function processDocumentStep(
  supabase: SupabaseClient,
  row: DocumentRow,
): Promise<ProcessResult> {
  if (row.status === "ready" || row.status === "failed") {
    return { document: toDocumentRecord(row), done: true };
  }
  if (row.chunk_count === 0) {
    return runExtractPhase(supabase, row);
  }
  return runEmbedPhase(supabase, row);
}

// Progress for a document already being displayed (polled/listed), without
// advancing any work. Only meaningful while embedding.
export async function getProcessingProgress(
  supabase: SupabaseClient,
  row: DocumentRow,
): Promise<ProcessingProgress | undefined> {
  if (row.status !== "embedding" || row.chunk_count === 0) return undefined;
  const remaining = await countUnembedded(supabase, row.id);
  return { total: row.chunk_count, embedded: Math.max(0, row.chunk_count - remaining) };
}
