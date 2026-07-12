import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateAnswer } from "@/lib/rag/answer";
import { MAX_QUESTION_LENGTH } from "@/lib/rag/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";

export const runtime = "nodejs";
export const maxDuration = 45;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Non-streaming RAG turn; the voice path (/api/vapi/chat/completions) shares
// the same retrieval/prompt/logging logic but streams the LLM response.
export async function POST(request: Request) {
  try {
    return await handleAnswer(request);
  } catch (err) {
    return errorResponse("UNEXPECTED_ERROR", (err as Error).message || "Something went wrong.", 500);
  }
}

async function handleAnswer(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(sessionId)) {
    return errorResponse("NO_SESSION", "Missing session cookie.", 400);
  }

  const rateLimit = checkRateLimit(`rag-answer:${sessionId}`, 20, 5 * 60 * 1000);
  if (!rateLimit.allowed) {
    return errorResponse("RATE_LIMITED", "Too many questions. Please slow down and try again shortly.", 429);
  }

  let body: { question?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not parse the request body.", 400);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return errorResponse("VALIDATION_FAILED", 'A non-empty "question" string is required.', 400);
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return errorResponse("VALIDATION_FAILED", `"question" must be ${MAX_QUESTION_LENGTH} characters or fewer.`, 400);
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return errorResponse("SERVER_NOT_CONFIGURED", (err as Error).message, 500);
  }

  const result = await generateAnswer(supabase, sessionId, question);
  return NextResponse.json({
    answer: result.answer,
    referencedDocumentIds: result.referencedDocumentIds,
    chunks: result.chunks,
  });
}
