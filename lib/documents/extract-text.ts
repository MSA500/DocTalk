import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";
import type { DocumentFileType } from "@/lib/types/document";

export class TextExtractionError extends Error {}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    // pdf.js rejects a Node Buffer; slice the view (not copy) to respect
    // a Buffer offset into a larger pooled ArrayBuffer.
    const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const { text } = await extractPdfText(data, { mergePages: true });
    return text;
  } catch (cause) {
    throw new TextExtractionError(
      `Could not read this PDF. It may be encrypted, corrupted, or scanned without a text layer.`,
      { cause },
    );
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (cause) {
    throw new TextExtractionError(`Could not read this DOCX file. It may be corrupted.`, { cause });
  }
}

function extractTxt(buffer: Buffer): string {
  return buffer.toString("utf-8");
}

export async function extractText(buffer: Buffer, fileType: DocumentFileType): Promise<string> {
  let text: string;
  switch (fileType) {
    case "pdf":
      text = await extractPdf(buffer);
      break;
    case "docx":
      text = await extractDocx(buffer);
      break;
    case "txt":
      text = extractTxt(buffer);
      break;
  }

  if (!text || text.trim().length === 0) {
    throw new TextExtractionError(
      "No readable text was found in this file. Scanned documents without a text layer aren't supported yet.",
    );
  }

  return text;
}
