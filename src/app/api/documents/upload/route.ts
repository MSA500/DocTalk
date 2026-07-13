import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildStoragePath, uploadDocumentFile } from "@/lib/documents/storage";
import {
  MAX_FILE_SIZE_BYTES,
  ValidationError,
  resolveFileType,
  validateFileSize,
} from "@/lib/documents/validate-upload";
import { SESSION_COOKIE, isValidSessionId } from "@/lib/session-cookie";
import { checkRateLimit } from "@/lib/rate-limit";
import { toDocumentRecord, type DocumentRow } from "@/lib/types/document";

export const runtime = "nodejs";
export const maxDuration = 60;

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Returns before extraction/chunking/embedding so the client gets a fast
// response; the client then calls POST /api/documents/[id]/process.
export async function POST(request: Request) {
  try {
    return await handleUpload(request);
  } catch (err) {
    return errorResponse("UNEXPECTED_ERROR", (err as Error).message || "Something went wrong.", 500);
  }
}

async function handleUpload(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_SIZE_BYTES * 1.5) {
    return errorResponse(
      "FILE_TOO_LARGE",
      `File is too large. The maximum is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      413,
    );
  }

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("INVALID_REQUEST", "Could not read the upload request.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse("NO_FILE", "No file was provided.", 400);
  }

  let fileType;
  try {
    fileType = resolveFileType(file.name, file.type);
    validateFileSize(file.size);
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse("VALIDATION_FAILED", err.message, 400);
    }
    throw err;
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const { data: inserted, error: insertError } = await supabase
    .from("documents")
    .insert({
      session_id: sessionId,
      filename: file.name,
      file_type: fileType,
      size_bytes: file.size,
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
  const storagePath = buildStoragePath(sessionId, documentRow.id, file.name);

  try {
    await uploadDocumentFile(storagePath, buffer, file.type || "application/octet-stream");
  } catch (err) {
    const { data } = await supabase
      .from("documents")
      .update({ status: "failed", error_message: `Upload to storage failed: ${(err as Error).message}` })
      .eq("id", documentRow.id)
      .select()
      .single();
    return NextResponse.json({
      document: toDocumentRecord(
        (data as DocumentRow | null) ?? {
          ...documentRow,
          status: "failed",
          error_message: "Upload to storage failed.",
        },
      ),
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ storage_path: storagePath, status: "extracting" })
    .eq("id", documentRow.id)
    .select()
    .single();

  if (updateError || !updated) {
    // File is in Storage but storage_path failed to persist — fail loudly
    // now rather than letting /process fail later with a confusing error.
    const { data } = await supabase
      .from("documents")
      .update({
        status: "failed",
        error_message: `Could not save the upload record: ${updateError?.message ?? "unknown error"}`,
      })
      .eq("id", documentRow.id)
      .select()
      .single();
    return NextResponse.json({
      document: toDocumentRecord(
        (data as DocumentRow | null) ?? {
          ...documentRow,
          status: "failed",
          error_message: "Could not save the upload record.",
        },
      ),
    });
  }

  return NextResponse.json({ document: toDocumentRecord(updated as DocumentRow) });
}
