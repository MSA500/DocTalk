import { EmbeddingConfigError, type EmbeddingProvider } from "@/lib/ai/embeddings/types";

const DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const DEFAULT_DIMENSIONS = 384;

export function createHuggingFaceProvider(): EmbeddingProvider {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new EmbeddingConfigError("EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER=huggingface.");
  }

  return {
    dimensions: DEFAULT_DIMENSIONS,
    async embed(texts) {
      const response = await fetch(
        `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: texts, normalize: true }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Hugging Face embedding request failed (${response.status}): ${errorBody.slice(0, 300)}`,
        );
      }

      const data: unknown = await response.json();
      return normalizeResponse(data);
    },
  };
}

function normalizeResponse(data: unknown): number[][] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Unexpected empty embedding response from Hugging Face.");
  }

  const first = data[0];

  if (typeof first === "number") {
    return [data as number[]];
  }

  if (Array.isArray(first) && typeof first[0] === "number") {
    return data as number[][];
  }

  if (Array.isArray(first) && Array.isArray(first[0])) {
    return (data as number[][][]).map(meanPool);
  }

  throw new Error("Unrecognized embedding response shape from Hugging Face.");
}

function meanPool(tokenEmbeddings: number[][]): number[] {
  const dims = tokenEmbeddings[0]?.length ?? 0;
  const sums = new Array(dims).fill(0) as number[];
  for (const token of tokenEmbeddings) {
    for (let i = 0; i < dims; i++) sums[i] += token[i];
  }
  return sums.map((sum) => sum / tokenEmbeddings.length);
}
