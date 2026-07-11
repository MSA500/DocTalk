import type { ChatMessage } from "@/lib/ai/llm";
import type { RetrievedChunk } from "@/lib/rag/search";

// Used verbatim whenever retrieval finds nothing at all, or nothing even
// loosely related (top similarity below NEAR_MISS_SIMILARITY_THRESHOLD) —
// the LLM is never even called in that case, so there's no way for it to
// hallucinate an answer to a question with zero supporting context.
export const NO_DOCUMENTS_ANSWER =
  "I couldn't find anything about that in your uploaded documents. Try uploading a document that covers this, or ask something else.";

// Cosine similarity thresholds for the default embedding model
// (sentence-transformers/all-MiniLM-L6-v2 — see
// lib/ai/embeddings/huggingface.ts). Tuned empirically this round against a
// real document (a short report naming a specific, unusual entity —
// "Kalsoom Ahmad Hospital") and real Hugging Face embeddings, not guessed:
//
//   exact name match ("What is Kalsoom Ahmad Hospital?")            0.731
//   topic paraphrase, no exact name ("the hospital in this report") 0.772
//   misheard name, close ("Kulsum Ahmed Hospital")                  0.665
//   misheard name, far ("Xyz Hospital")                             0.591
//   same domain, wrong topic ("infant vaccination schedule")        0.511
//   unrelated ("capital of France")                                 0.384
//   unrelated, different domain ("bake a chocolate cake")           0.349
//
// The first guessed values (0.45 / 0.28) were wrong for this model — even
// the fully unrelated queries scored well above them, which would have
// classified plainly out-of-scope questions as "near-miss". Full numbers
// and the actual live-tested answers are in Project_status.md.
//
//   >= CONFIDENT (0.70)  -> answer normally, grounded in the excerpts.
//   >= NEAR_MISS (0.45) but < CONFIDENT -> real but weak signal, the classic
//     "speech-to-text mangled a proper noun" shape -> a "did you mean"
//     style clarifying answer instead of a flat "not found".
//   < NEAR_MISS (or zero chunks) -> treated as no match at all.
export const CONFIDENT_SIMILARITY_THRESHOLD = 0.7;
export const NEAR_MISS_SIMILARITY_THRESHOLD = 0.45;

export type RetrievalClassification = "confident" | "near-miss" | "none";

export function classifyRetrieval(chunks: RetrievedChunk[]): RetrievalClassification {
  if (chunks.length === 0) return "none";
  const topSimilarity = chunks[0].similarity;
  if (topSimilarity >= CONFIDENT_SIMILARITY_THRESHOLD) return "confident";
  if (topSimilarity >= NEAR_MISS_SIMILARITY_THRESHOLD) return "near-miss";
  return "none";
}

const SYSTEM_PROMPT = `You are DocTalk, a voice assistant that answers questions using only the user's own uploaded documents.

Rules:
- Answer using ONLY the retrieved excerpts provided below. Never use outside knowledge, and never guess or make anything up.
- If the excerpts don't actually contain enough information to answer the question, say so plainly and directly instead of speculating.
- Keep answers concise and conversational — they will be read aloud, not displayed on a screen.
- You may mention which document an answer came from when it's useful context.
- This is a SPOKEN conversation. Never write section, clause, or subsection numbers as bare digits with dots (e.g. "5.1.4") — text-to-speech reads that kind of numeral unreliably. Instead spell the reference out the way a person would say it aloud, e.g. "section five point one point four", or better, favor describing what the clause covers over reciting its number when the number itself isn't essential to answering the question.`;

// Used specifically for the "near-miss" classification — retrieval found
// something, but not confidently enough to just answer as if the question
// matched. This is the generalized fix for misheard/mismatched entity
// names (a wrong hospital, person, place, document title, technical term,
// etc. from imperfect speech-to-text): rather than only ever saying "not
// found", the model is asked to look for a plausible near-miss *that
// actually appears in the retrieved text* and offer it as a clarifying
// suggestion — never inventing a name from outside the excerpts.
const NEAR_MISS_SYSTEM_PROMPT = `You are DocTalk, a voice assistant that answers questions using only the user's own uploaded documents.

The excerpts below are only a loose match for the question as asked — nothing in them directly confirms the exact name or term the user used. This commonly happens when speech-to-text mishears a specific name: a person, place, organization, document title, or technical term.

Rules:
- Look through the excerpts for a specific name or term that could plausibly be what the user actually meant — a near-miss for what they said. Only ever mention a name that is written verbatim in the excerpts below. Never invent, correct, or guess at a name that doesn't literally appear there.
- If you find a plausible near-miss, say so naturally and briefly — for example: "I couldn't find an exact match for '<what they asked>', but I did find '<name from the excerpts>' — did you mean that?" Keep it conversational and short, since this will be read aloud.
- If nothing in the excerpts looks like a plausible near-miss for the question, say plainly that it isn't in the documents. Do not force a suggestion that isn't really there.
- Never use outside knowledge. Only ever reference names or terms that literally appear in the excerpts below.
- This is a SPOKEN conversation — never write section/clause numbers as bare digits with dots; spell them out (e.g. "five point one point four").`;

function buildContextBlock(chunks: RetrievedChunk[]): string {
  return chunks.map((chunk, i) => `[${i + 1}] (from "${chunk.documentFilename}")\n${chunk.chunkText}`).join("\n\n");
}

export function buildGroundedMessages(question: string, chunks: RetrievedChunk[]): ChatMessage[] {
  return [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nRetrieved excerpts:\n${buildContextBlock(chunks)}` },
    { role: "user", content: question },
  ];
}

export function buildNearMissMessages(question: string, chunks: RetrievedChunk[]): ChatMessage[] {
  return [
    { role: "system", content: `${NEAR_MISS_SYSTEM_PROMPT}\n\nRetrieved excerpts:\n${buildContextBlock(chunks)}` },
    { role: "user", content: question },
  ];
}

// Single decision point shared by both /api/rag/answer and the Vapi
// streaming route, so the two entry points can never drift apart on this
// logic. Returns null for "none" — callers should use NO_DOCUMENTS_ANSWER
// directly rather than calling the LLM at all.
export function buildMessagesForClassification(
  question: string,
  chunks: RetrievedChunk[],
  classification: RetrievalClassification,
): ChatMessage[] | null {
  if (classification === "none") return null;
  return classification === "near-miss" ? buildNearMissMessages(question, chunks) : buildGroundedMessages(question, chunks);
}
