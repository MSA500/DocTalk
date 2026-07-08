import type { DocumentType } from "@/lib/mock-data";

const EXTENSION_MAP: Record<string, DocumentType> = {
  pdf: "pdf",
  doc: "docx",
  docx: "docx",
  txt: "txt",
  md: "md",
  markdown: "md",
  csv: "csv",
};

export function getDocumentType(filename: string): DocumentType {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[extension] ?? "txt";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
