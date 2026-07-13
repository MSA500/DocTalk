import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildStoragePath, createDocumentUploadUrl } from "@/lib/documents/storage";
import { ValidationError, resolveFileType, validateFileSize } from "@/lib/documents/validate-upload";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { toDocumentRecord, type DocumentRow } from "@/lib/types/document";

export const runtime = "nodejs";
export const maxDuration = 30;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Step 1 of 2 for a direct-to-Storage upload (see confirm-upload/route.ts for
// step 2). This request carries only filename/size/type — never the file
// itself — so it stays well under Vercel's serverless request body limit
// regardless of how large the actual file is. The client uploads the real
// bytes straight to the signed URL this returns, then calls confirm-upload.
export async function POST(request: Request) {
  try {
    return await handlePrepareUpload(request);
  } catch (err) {
    return errorResponse("UNEXPECTED_ERROR", (err as Error).message || "Something went wrong.", 500);
  }
}

async function handlePrepareUpload(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!isValidSessionId(sessionId)) {
    return errorResponse("NO_SESSION", "Missing session cookie.", 400);
  }

  const rateLimit = checkRateLimit(`upload:${sessionId}`, 10, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    return errorResponse("RATE_LIMITED", "Too many uploads. Please slow down and try again shortly.", 429);
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseServerClient();
  } catch (err) {
    return errorResponse("SERVER_NOT_CONFIGURED", (err as Error).message, 500);
  }

  let body: { filename?: unknown; sizeBytes?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not parse the request body.", 400);
  }

  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : NaN;
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";

  if (!filename || !Number.isFinite(sizeBytes)) {
    return errorResponse("VALIDATION_FAILED", "A filename and size are required.", 400);
  }

  let fileType;
  try {
    fileType = resolveFileType(filename, mimeType);
    validateFileSize(sizeBytes);
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse("VALIDATION_FAILED", err.message, 400);
    }
    throw err;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("documents")
    .insert({
      session_id: sessionId,
      filename,
      file_type: fileType,
      size_bytes: sizeBytes,
      storage_path: "",
      status: "uploading",
    })
    .select()
    .single();

  if (insertError || !inserted) {
    return errorResponse(
      "DATABASE_ERROR",
      `Could not create the document record: ${insertError?.message ?? "unknown error"}`,
      500,
    );
  }

  const documentRow = inserted as DocumentRow;
  const storagePath = buildStoragePath(sessionId, documentRow.id, filename);

  let signedUrl: string;
  try {
    signedUrl = await createDocumentUploadUrl(storagePath);
  } catch (err) {
    const { data } = await supabase
      .from("documents")
      .update({ status: "failed", error_message: (err as Error).message })
      .eq("id", documentRow.id)
      .select()
      .single();
    return NextResponse.json({
      document: toDocumentRecord((data as DocumentRow | null) ?? { ...documentRow, status: "failed" }),
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ storage_path: storagePath })
    .eq("id", documentRow.id)
    .select()
    .single();

  if (updateError || !updated) {
    return errorResponse("DATABASE_ERROR", "Could not save the upload record.", 500);
  }

  return NextResponse.json({
    document: toDocumentRecord(updated as DocumentRow),
    signedUrl,
  });
}
