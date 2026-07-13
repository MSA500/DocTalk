export type DocumentFileType = "pdf" | "docx" | "txt";
export type DocumentStatus = "uploading" | "extracting" | "embedding" | "ready" | "failed";

// Embedding progress for a document mid-processing: how many of its chunks
// have embeddings so far. Lives here (not in the server-only processing
// module) so client code can use the type without pulling in server code.
export type ProcessingProgress = { total: number; embedded: number };

export type DocumentRecord = {
  id: string;
  filename: string;
  fileType: DocumentFileType;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
};

export type DocumentRow = {
  id: string;
  session_id: string;
  filename: string;
  file_type: DocumentFileType;
  size_bytes: number;
  storage_path: string;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
};

export function toDocumentRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    filename: row.filename,
    fileType: row.file_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    errorMessage: row.error_message,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
  };
}
