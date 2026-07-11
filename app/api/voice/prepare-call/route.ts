import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createCallToken } from "@/lib/rag/call-token";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Vapi's servers call POST /api/vapi/chat/completions directly — a
// server-to-server request with no browser cookies attached — so the real
// doctalk-session id (httpOnly, never read by client JS by design) can't
// reach it that way. The client calls this route first (same-origin, so
// the httpOnly cookie *is* sent here), gets back a short-lived opaque
// call_token, and hands only that token to Vapi via the assistant's
// per-call model.url override. /api/vapi/chat/completions resolves the
// token back to the real session_id server-side.
export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!isValidSessionId(sessionId)) {
      return errorResponse("NO_SESSION", "Missing session cookie.", 400);
    }

    const supabase = getSupabaseServerClient();
    const callToken = await createCallToken(supabase, sessionId);
    return NextResponse.json({ callToken });
  } catch (err) {
    return errorResponse("SERVER_NOT_CONFIGURED", (err as Error).message || "Something went wrong.", 500);
  }
}
