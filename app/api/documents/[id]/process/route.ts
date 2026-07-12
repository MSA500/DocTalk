import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { downloadDocumentFile } from "@/lib/documents/storage";
import { extractText, TextExtractionError } from "@/lib/documents/extract-text";
import { chunkText } from "@/lib/documents/chunk-text";
import {
  EmbeddingConfigError,
  EXPECTED_EMBEDDING_DIMENSIONS,
  getEmbeddingProvider,
} from "@/lib/ai/embeddings";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { toDocumentRecord, type DocumentRow } from "@/lib/types/document";

export const runtime = "nodejs";
export const maxDuration = 60;

const EMBEDDING_BATCH_SIZE = 32;
const CHUNK_INSERT_BATCH_SIZE = 50;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Split out from upload so the client can poll GET /api/documents/[id] for
// live pipeline stages while this runs, instead of a frozen progress bar.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await handleProcess(await params);
  } catch (err) {
    return errorResponse("UNEXPECTED_ERROR", (err as Error).message || "Something went wrong.", 500);
  }
}

async function handleProcess({ id }: { id: string }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(sessionId)) {
    return errorResponse("NO_SESSION", "Missing session cookie.", 400);
  }

  const rateLimit = checkRateLimit(`process:${sessionId}`, 15, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please slow down and try again shortly.", 429);
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return errorResponse("SERVER_NOT_CONFIGURED", (err as Error).message, 500);
  }

  const { data: existing, error: fetchError } = await supabase
    .from("documents")
    .select()
    .eq("id", id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (fetchError) {
    return errorResponse("DATABASE_ERROR", fetchError.message, 500);
  }
  if (!existing) {
    return errorResponse("NOT_FOUND", "Document not found.", 404);
  }

  const documentRow = existing as DocumentRow;

  // Idempotency guard against client retries — don't reprocess a terminal document.
  if (documentRow.status === "ready" || documentRow.status === "failed") {
    return NextResponse.json({ document: toDocumentRecord(documentRow) });
  }

  async function failAndRespond(message: string) {
    const { data } = await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentRow.id)
      .select()
      .single();

    const row = (data as DocumentRow | null) ?? { ...documentRow, status: "failed" as const, error_message: message };
    return NextResponse.json({ document: toDocumentRecord(row) });
  }

  let buffer: Buffer;
  try {
    buffer = await downloadDocumentFile(documentRow.storage_path);
  } catch (err) {
    return failAndRespond(`Could not retrieve the uploaded file: ${(err as Error).message}`);
  }

  let text: string;
  try {
    text = await extractText(buffer, documentRow.file_type);
  } catch (err) {
    const message = err instanceof TextExtractionError ? err.message : "Could not extract text from this file.";
    return failAndRespond(message);
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return failAndRespond("No content could be extracted from this file.");
  }

  let provider;
  try {
    provider = getEmbeddingProvider();
  } catch (err) {
    const message = err instanceof EmbeddingConfigError ? err.message : "Embedding provider is not configured.";
    return failAndRespond(message);
  }

  if (provider.dimensions !== EXPECTED_EMBEDDING_DIMENSIONS) {
    return failAndRespond(
      `The configured embedding provider produces ${provider.dimensions}-dimension vectors, but the database expects ${EXPECTED_EMBEDDING_DIMENSIONS}. Update the schema or switch providers.`,
    );
  }

  const { error: embeddingStatusError } = await supabase
    .from("documents")
    .update({ status: "embedding" })
    .eq("id", documentRow.id);
  if (embeddingStatusError) {
    return failAndRespond(`Could not update processing status: ${embeddingStatusError.message}`);
  }

  const embeddedChunks: { chunk_index: number; chunk_text: string; embedding: number[] }[] = [];
  try {
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const vectors = await provider.embed(batch.map((chunk) => chunk.text));
      batch.forEach((chunk, j) => {
        embeddedChunks.push({ chunk_index: chunk.index, chunk_text: chunk.text, embedding: vectors[j] });
      });
    }
  } catch (err) {
    return failAndRespond(`Embedding generation failed: ${(err as Error).message}`);
  }

  try {
    const rows = embeddedChunks.map((chunk) => ({
      document_id: documentRow.id,
      chunk_index: chunk.chunk_index,
      chunk_text: chunk.chunk_text,
      embedding: chunk.embedding,
    }));
    for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH_SIZE) {
      const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + CHUNK_INSERT_BATCH_SIZE));
      if (error) throw new Error(error.message);
    }
  } catch (err) {
    return failAndRespond(`Saving chunks failed: ${(err as Error).message}`);
  }

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ status: "ready", chunk_count: embeddedChunks.length })
    .eq("id", documentRow.id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({
      document: toDocumentRecord({
        ...documentRow,
        status: "ready",
        chunk_count: embeddedChunks.length,
      }),
    });
  }

  return NextResponse.json({ document: toDocumentRecord(updated as DocumentRow) });
}
