import type { SupabaseClient } from "@supabase/supabase-js";
import { getLLMProvider } from "@/lib/ai/llm";
import { searchDocumentChunks, type RetrievedChunk } from "@/lib/rag/search";
import { buildGroundedMessages, NO_DOCUMENTS_ANSWER } from "@/lib/rag/prompt";
import { logConversationTurn } from "@/lib/rag/history";

export type AnswerResult = {
  answer: string;
  chunks: RetrievedChunk[];
  referencedDocumentIds: string[];
};

const TOP_K = 5;

// One full, standalone RAG turn: retrieve -> ground -> generate -> log.
// Used directly by POST /api/rag/answer and, in spirit, by
// POST /api/vapi/chat/completions (which streams instead of awaiting one
// complete() call, but shares searchDocumentChunks/buildGroundedMessages).
export async function generateAnswer(
  supabase: SupabaseClient,
  sessionId: string,
  question: string,
): Promise<AnswerResult> {
  const chunks = await searchDocumentChunks(supabase, sessionId, question, TOP_K);
  const referencedDocumentIds = Array.from(new Set(chunks.map((chunk) => chunk.documentId)));

  // No retrieved context at all (empty library, or nothing relevant) means
  // the LLM is never even called — there's nothing it could ground an
  // answer in, so skipping the call entirely is what actually prevents
  // hallucination here, rather than just hoping the prompt is obeyed.
  const answer =
    chunks.length === 0 ? NO_DOCUMENTS_ANSWER : await getLLMProvider().complete(buildGroundedMessages(question, chunks));

  console.log(`generateAnswer: raw answer text = ${JSON.stringify(answer)}`);

  try {
    await logConversationTurn(supabase, sessionId, question, answer, referencedDocumentIds);
  } catch (err) {
    // Non-critical: the caller still gets a real answer even if persisting
    // it to conversation_turns fails. Only the saved transcript degrades.
    console.error("Failed to log conversation turn:", err);
  }

  return { answer, chunks, referencedDocumentIds };
}
