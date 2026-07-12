import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createCallToken } from "@/lib/rag/call-token";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Vapi calls /api/vapi/chat/completions server-to-server with no browser
// cookies, so the httpOnly session cookie can't reach it directly. The
// client calls this route first (same-origin, cookie included) to get a
// short-lived opaque call_token to hand to Vapi instead.
export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!isValidSessionId(sessionId)) {
      return errorResponse("NO_SESSION", "Missing session cookie.", 400);
    }

    const rateLimit = checkRateLimit(`prepare-call:${sessionId}`, 20, 5 * 60 * 1000);
    if (!rateLimit.allowed) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please slow down and try again shortly.", 429);
    }

    const supabase = getSupabaseServerClient();
    const callToken = await createCallToken(supabase, sessionId);
    return NextResponse.json({ callToken });
  } catch (err) {
    return errorResponse("SERVER_NOT_CONFIGURED", (err as Error).message || "Something went wrong.", 500);
  }
}
