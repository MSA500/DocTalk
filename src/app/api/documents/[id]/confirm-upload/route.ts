import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { documentFileExists } from "@/lib/documents/storage";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { toDocumentRecord, type DocumentRow } from "@/lib/types/document";

export const runtime = "nodejs";
export const maxDuration = 30;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Step 2 of 2 for a direct-to-Storage upload (see prepare-upload/route.ts for
// step 1). The client calls this after its own PUT to the signed URL settles
// — with success:true once that PUT succeeded, or success:false if it failed
// — so a document is never left waiting forever on a file that never arrived.
// On success this re-checks Storage itself before trusting it, since the
// only alternative is trusting the client's word for it.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await handleConfirm(request, await params);
  } catch (err) {
    return errorResponse("UNEXPECTED_ERROR", (err as Error).message || "Something went wrong.", 500);
  }
}

async function handleConfirm(request: Request, { id }: { id: string }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(sessionId)) {
    return errorResponse("NO_SESSION", "Missing session cookie.", 400);
  }

  const rateLimit = checkRateLimit(`confirm-upload:${sessionId}`, 30, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return errorResponse("RATE_LIMITED", "Too many requests. Please slow down and try again shortly.", 429);
  }

  let body: { success?: unknown; errorMessage?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not parse the request body.", 400);
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

  // Idempotency guard: a retried confirm call (or one that arrives after the
  // pipeline has already moved on) should just report current state.
  if (documentRow.status !== "uploading") {
    return NextResponse.json({ document: toDocumentRecord(documentRow) });
  }

  const clientSucceeded = body.success === true;
  const clientMessage =
    typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 300) : undefined;

  if (!clientSucceeded) {
    const { data } = await supabase
      .from("documents")
      .update({ status: "failed", error_message: clientMessage || "The upload was interrupted." })
      .eq("id", id)
      .select()
      .single();
    return NextResponse.json({
      document: toDocumentRecord((data as DocumentRow | null) ?? { ...documentRow, status: "failed" }),
    });
  }

  const exists = await documentFileExists(documentRow.storage_path);
  if (!exists) {
    const { data } = await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: "Upload could not be confirmed — the file wasn't found in storage.",
      })
      .eq("id", id)
      .select()
      .single();
    return NextResponse.json({
      document: toDocumentRecord((data as DocumentRow | null) ?? { ...documentRow, status: "failed" }),
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ status: "extracting" })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return errorResponse("DATABASE_ERROR", "Could not update the document status.", 500);
  }

  return NextResponse.json({ document: toDocumentRecord(updated as DocumentRow) });
}
