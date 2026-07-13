import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { processDocumentStep } from "@/lib/documents/process-document";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { type DocumentRow } from "@/lib/types/document";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// One bounded step of the extract -> embed pipeline. The client calls this
// repeatedly until the response reports `done`, so no single invocation has
// to embed a whole large document within the serverless time limit. See
// lib/documents/process-document.ts for the phase logic.
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

  // Generous per-session limit: one large document takes many continuation
  // calls (extract + a bounded embed step each), so this caps abuse without
  // throttling legitimate large-document processing.
  const rateLimit = checkRateLimit(`process:${sessionId}`, 300, 10 * 60 * 1000);
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

  const result = await processDocumentStep(supabase, existing as DocumentRow);
  return NextResponse.json({
    document: result.document,
    done: result.done,
    retryable: result.retryable ?? false,
    progress: result.progress,
  });
}
