import type { SupabaseClient } from "@supabase/supabase-js";
import { getLLMProvider } from "@/lib/ai/llm";
import { searchDocumentChunks, type RetrievedChunk } from "@/lib/rag/search";
import { buildMessagesForClassification, classifyRetrieval, NO_DOCUMENTS_ANSWER } from "@/lib/rag/prompt";
import { logConversationTurn } from "@/lib/rag/history";

export type AnswerResult = {
  answer: string;
  chunks: RetrievedChunk[];
  referencedDocumentIds: string[];
};

const TOP_K = 5;

// One full, standalone RAG turn: retrieve -> classify -> ground -> generate
// -> log. Used directly by POST /api/rag/answer and, in spirit, by
// POST /api/vapi/chat/completions (which streams instead of awaiting one
// complete() call, but shares searchDocumentChunks/classifyRetrieval/
// buildMessagesForClassification).
export async function generateAnswer(
  supabase: SupabaseClient,
  sessionId: string,
  question: string,
): Promise<AnswerResult> {
  const chunks = await searchDocumentChunks(supabase, sessionId, question, TOP_K);
  const classification = classifyRetrieval(chunks);

  // "none" means nothing retrieved was even loosely related — the LLM is
  // never called, and no documents are credited as referenced, since
  // nothing here is actually informing the answer. This is what actually
  // prevents hallucination for a genuinely irrelevant question, rather than
  // just hoping the prompt is obeyed.
  const referencedDocumentIds =
    classification === "none" ? [] : Array.from(new Set(chunks.map((chunk) => chunk.documentId)));

  const messages = buildMessagesForClassification(question, chunks, classification);
  const answer = messages ? await getLLMProvider().complete(messages) : NO_DOCUMENTS_ANSWER;

  console.log(
    `generateAnswer: classification=${classification} topSimilarity=${chunks[0]?.similarity ?? "n/a"} raw answer text = ${JSON.stringify(answer)}`,
  );

  try {
    await logConversationTurn(supabase, sessionId, question, answer, referencedDocumentIds);
  } catch (err) {
    // Non-critical: the caller still gets a real answer even if persisting
    // it to conversation_turns fails. Only the saved transcript degrades.
    console.error("Failed to log conversation turn:", err);
  }

  return { answer, chunks, referencedDocumentIds };
}
