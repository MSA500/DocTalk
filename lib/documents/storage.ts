import { getSupabaseServerClient } from "@/lib/supabase/server";

export const DOCUMENTS_BUCKET = "documents";

export function buildStoragePath(sessionId: string, documentId: string, filename: string): string {
  return `${sessionId}/${documentId}/${filename}`;
}

export async function uploadDocumentFile(
  path: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, data, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

export async function deleteDocumentFile(path: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
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
