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

export async function generateAnswer(
  supabase: SupabaseClient,
  sessionId: string,
  question: string,
): Promise<AnswerResult> {
  const chunks = await searchDocumentChunks(supabase, sessionId, question, TOP_K);
  const classification = classifyRetrieval(chunks);

  // "none" means nothing retrieved was even loosely related — skip the LLM
  // call and credit no documents, which is what actually prevents
  // hallucination here rather than just hoping the prompt is obeyed.
  const referencedDocumentIds =
    classification === "none" ? [] : Array.from(new Set(chunks.map((chunk) => chunk.documentId)));

  const messages = buildMessagesForClassification(question, chunks, classification);
  const answer = messages ? await getLLMProvider().complete(messages) : NO_DOCUMENTS_ANSWER;

  try {
    await logConversationTurn(supabase, sessionId, question, answer, referencedDocumentIds);
  } catch (err) {
    // Non-critical: the caller still gets a real answer even if this fails.
    console.error("Failed to log conversation turn:", err);
  }

  return { answer, chunks, referencedDocumentIds };
}
