import type { ChatMessage } from "@/lib/ai/llm";
import type { RetrievedChunk } from "@/lib/rag/search";

// Used verbatim whenever retrieval finds nothing at all — the LLM is never
// even called in that case, so there's no way for it to hallucinate an
// answer to a question with zero supporting context.
export const NO_DOCUMENTS_ANSWER =
  "I couldn't find anything about that in your uploaded documents. Try uploading a document that covers this, or ask something else.";

const SYSTEM_PROMPT = `You are DocTalk, a voice assistant that answers questions using only the user's own uploaded documents.

Rules:
- Answer using ONLY the retrieved excerpts provided below. Never use outside knowledge, and never guess or make anything up.
- If the excerpts don't actually contain enough information to answer the question, say so plainly and directly instead of speculating.
- Keep answers concise and conversational — they will be read aloud, not displayed on a screen.
- You may mention which document an answer came from when it's useful context.`;

export function buildGroundedMessages(question: string, chunks: RetrievedChunk[]): ChatMessage[] {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (from "${chunk.documentFilename}")\n${chunk.chunkText}`)
    .join("\n\n");

  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nRetrieved excerpts:\n${context}` },
    { role: "user", content: question },
  ];
}
