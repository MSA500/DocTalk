import type { DocumentFileType } from "@/lib/types/document";

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const MIME_TO_TYPE: Record<string, DocumentFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

const EXTENSION_TO_TYPE: Record<string, DocumentFileType> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
};

export class ValidationError extends Error {}

export function resolveFileType(filename: string, mimeType: string): DocumentFileType {
  if (mimeType && MIME_TO_TYPE[mimeType]) {
    return MIME_TO_TYPE[mimeType];
  }

  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const byExtension = EXTENSION_TO_TYPE[extension];
  if (byExtension) return byExtension;

  throw new ValidationError("Unsupported file type. DocTalk accepts PDF, DOCX, and TXT files only.");
}

export function validateFileSize(sizeBytes: number): void {
  if (sizeBytes === 0) {
    throw new ValidationError("This file is empty.");
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    const actualMb = (sizeBytes / (1024 * 1024)).toFixed(1);
    throw new ValidationError(`File is too large (${actualMb} MB). The maximum is ${maxMb} MB.`);
  }
}
