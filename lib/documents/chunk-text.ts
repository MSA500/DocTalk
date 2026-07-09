export type ChunkOptions = {
  chunkSizeTokens?: number;
  overlapTokens?: number;
};

export type TextChunk = {
  index: number;
  text: string;
};

const CHARS_PER_TOKEN = 4;
const DEFAULT_CHUNK_SIZE_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

const SENTENCE_PATTERN = /[^.!?\n]+[.!?]+(\s+|$)|[^.!?\n]+$/g;

function splitIntoSentences(text: string): string[] {
  const matches = text.match(SENTENCE_PATTERN);
  if (!matches) return [text.trim()].filter(Boolean);
  return matches.map((s) => s.trim()).filter(Boolean);
}

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const chunkSizeChars = (options.chunkSizeTokens ?? DEFAULT_CHUNK_SIZE_TOKENS) * CHARS_PER_TOKEN;
  const overlapChars = (options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS) * CHARS_PER_TOKEN;

  const sentences = splitIntoSentences(text.replace(/\r\n/g, "\n").trim());
  if (sentences.length === 0) return [];

  const chunks: TextChunk[] = [];
  let currentSentences: string[] = [];
  let currentLength = 0;

  const pushCurrent = () => {
    if (currentSentences.length > 0) {
      chunks.push({ index: chunks.length, text: currentSentences.join(" ") });
    }
  };

  for (const sentence of sentences) {
    if (sentence.length > chunkSizeChars) {
      pushCurrent();
      currentSentences = [];
      currentLength = 0;
      for (let i = 0; i < sentence.length; i += chunkSizeChars) {
        chunks.push({ index: chunks.length, text: sentence.slice(i, i + chunkSizeChars) });
      }
      continue;
    }

    if (currentLength + sentence.length + 1 > chunkSizeChars && currentSentences.length > 0) {
      pushCurrent();

      let overlapLen = 0;
      const overlapSentences: string[] = [];
      for (let i = currentSentences.length - 1; i >= 0; i--) {
        const candidate = currentSentences[i];
        if (overlapLen + candidate.length > overlapChars) break;
        overlapSentences.unshift(candidate);
        overlapLen += candidate.length + 1;
      }
      currentSentences = overlapSentences;
      currentLength = overlapLen;
    }

    currentSentences.push(sentence);
    currentLength += sentence.length + 1;
  }

  pushCurrent();

  return chunks;
}
