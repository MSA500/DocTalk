import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { searchDocumentChunks } from "@/lib/rag/search";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";

export const runtime = "nodejs";
export const maxDuration = 30;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Standalone vector similarity search — embeds `query` and returns the
// top-K matching chunks from this session's own ready documents, with no
// LLM call involved. Exists both as a real capability in its own right and
// as an independently-testable/curl-able building block of
// POST /api/rag/answer.
export async function POST(request: Request) {
  try {
    return await handleSearch(request);
  } catch (err) {
    return errorResponse("UNEXPECTED_ERROR", (err as Error).message || "Something went wrong.", 500);
  }
}

async function handleSearch(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(sessionId)) {
    return errorResponse("NO_SESSION", "Missing session cookie.", 400);
  }

  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not parse the request body.", 400);
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return errorResponse("VALIDATION_FAILED", 'A non-empty "query" string is required.', 400);
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return errorResponse("SERVER_NOT_CONFIGURED", (err as Error).message, 500);
  }

  const chunks = await searchDocumentChunks(supabase, sessionId, query);
  return NextResponse.json({ chunks });
}
