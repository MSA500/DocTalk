import { getSupabaseServerClient } from "@/lib/supabase/server";

export const DOCUMENTS_BUCKET = "documents";

export function buildStoragePath(sessionId: string, documentId: string, filename: string): string {
  return `${sessionId}/${documentId}/${filename}`;
}

export async function deleteDocumentFile(path: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

// Large files are uploaded directly from the browser to Storage (not routed
// through our API — see prepare-upload/route.ts), so instead of accepting the
// bytes ourselves we hand the client a short-lived signed URL to PUT to.
export async function createDocumentUploadUrl(path: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    throw new Error(`Could not create an upload URL: ${error?.message ?? "unknown error"}`);
  }
  return data.signedUrl;
}

// Confirms the client's direct upload actually landed in Storage before we
// trust storage_path and move the document into the processing pipeline —
// a client that reports success without one succeeding (or never calls back)
// would otherwise leave a document stuck waiting on a file that never arrives.
export async function documentFileExists(path: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const lastSlash = path.lastIndexOf("/");
  const folder = path.slice(0, lastSlash);
  const filename = path.slice(lastSlash + 1);
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).list(folder, { search: filename });
  if (error) return false;
  return (data ?? []).some((file) => file.name === filename);
}

export async function downloadDocumentFile(path: string): Promise<Buffer> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message ?? "no data returned"}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
