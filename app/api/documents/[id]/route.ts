import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deleteDocumentFile } from "@/lib/documents/storage";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { toDocumentRecord, type DocumentRow } from "@/lib/types/document";

export const runtime = "nodejs";

// Polled by the client while a document's status is uploading/extracting/
// embedding, to reflect real backend pipeline progress instead of a stalled
// progress bar — see lib/hooks/useDocumentWorkspace.ts.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!isValidSessionId(sessionId)) {
      return NextResponse.json({ error: { code: "NO_SESSION", message: "Missing session cookie." } }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("documents")
      .select()
      .eq("id", id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: { code: "DATABASE_ERROR", message: error.message } }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });
    }

    return NextResponse.json({ document: toDocumentRecord(data as DocumentRow) });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_NOT_CONFIGURED", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!isValidSessionId(sessionId)) {
      return NextResponse.json({ error: { code: "NO_SESSION", message: "Missing session cookie." } }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchError } = await supabase
      .from("documents")
      .select()
      .eq("id", id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: fetchError.message } },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Document not found." } }, { status: 404 });
    }

    const documentRow = existing as DocumentRow;
    if (documentRow.storage_path) {
      try {
        await deleteDocumentFile(documentRow.storage_path);
      } catch {
        // Storage cleanup best-effort — an orphaned file is a smaller problem
        // than a document the user can no longer remove from the library.
      }
    }

    const { error: deleteError } = await supabase.from("documents").delete().eq("id", id);
    if (deleteError) {
      return NextResponse.json(
        { error: { code: "DATABASE_ERROR", message: deleteError.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: "SERVER_NOT_CONFIGURED", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
