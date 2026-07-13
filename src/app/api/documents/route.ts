import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getProcessingProgress } from "@/lib/documents/process-document";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { toDocumentRecord, type DocumentRow, type ProcessingProgress } from "@/lib/types/document";

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

    const rows = data as DocumentRow[];

    // Only in-progress documents need a (per-document count) progress lookup;
    // ready/failed ones are the common case and skip it.
    const progress: Record<string, ProcessingProgress> = {};
    await Promise.all(
      rows
        .filter((row) => row.status === "embedding")
        .map(async (row) => {
          const p = await getProcessingProgress(supabase, row);
          if (p) progress[row.id] = p;
        }),
    );

    return NextResponse.json({
      documents: rows.map(toDocumentRecord),
      progress,
    });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_NOT_CONFIGURED", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
