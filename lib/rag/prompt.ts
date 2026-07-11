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
- You may mention which document an answer came from when it's useful context.
- This is a SPOKEN conversation. Never write section, clause, or subsection numbers as bare digits with dots (e.g. "5.1.4") — text-to-speech reads that kind of numeral unreliably. Instead spell the reference out the way a person would say it aloud, e.g. "section five point one point four", or better, favor describing what the clause covers over reciting its number when the number itself isn't essential to answering the question.`;

export function buildGroundedMessages(question: string, chunks: RetrievedChunk[]): ChatMessage[] {
  const context = chunks
    .map((chunk, i) => `[${i + 1}] (from "${chunk.documentFilename}")\n${chunk.chunkText}`)
    .join("\n\n");

  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nRetrieved excerpts:\n${context}` },
    { role: "user", content: question },
  ];
}
