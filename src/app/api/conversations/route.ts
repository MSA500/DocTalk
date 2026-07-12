import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getConversationHistory } from "@/lib/rag/history";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!isValidSessionId(sessionId)) {
      return NextResponse.json({ error: { code: "NO_SESSION", message: "Missing session cookie." } }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const turns = await getConversationHistory(supabase, sessionId);
    return NextResponse.json({ turns });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_NOT_CONFIGURED", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
