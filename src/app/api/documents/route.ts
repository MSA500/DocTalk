import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { toDocumentRecord, type DocumentRow } from "@/lib/types/document";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!isValidSessionId(sessionId)) {
      return NextResponse.json({ documents: [] });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("documents")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      documents: (data as DocumentRow[]).map(toDocumentRecord),
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_NOT_CONFIGURED", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
