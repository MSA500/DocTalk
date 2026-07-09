import { EmbeddingConfigError, type EmbeddingProvider } from "@/lib/ai/embeddings/types";

const DEFAULT_MODEL = "text-embedding-3-small";

const KNOWN_MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

export function createOpenAIProvider(): EmbeddingProvider {
  const apiKey = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new EmbeddingConfigError("EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER=openai.");
  }

  return {
    dimensions: KNOWN_MODEL_DIMENSIONS[model] ?? 1536,
    async embed(texts) {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: texts, model }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`OpenAI embedding request failed (${response.status}): ${errorBody.slice(0, 300)}`);
      }

      const data = (await response.json()) as { data: { embedding: number[]; index: number }[] };
      return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
    },
  };
}
