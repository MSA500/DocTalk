import { createHuggingFaceProvider } from "@/lib/ai/embeddings/huggingface";
import { createOpenAIProvider } from "@/lib/ai/embeddings/openai";
import { EmbeddingConfigError, type EmbeddingProvider } from "@/lib/ai/embeddings/types";

export type { EmbeddingProvider };
export { EmbeddingConfigError, EXPECTED_EMBEDDING_DIMENSIONS } from "@/lib/ai/embeddings/types";

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = (process.env.EMBEDDING_PROVIDER || "huggingface").toLowerCase();

  switch (provider) {
    case "huggingface":
      return createHuggingFaceProvider();
    case "openai":
      return createOpenAIProvider();
    default:
      throw new EmbeddingConfigError(
        `Unknown EMBEDDING_PROVIDER "${provider}". Supported values: "huggingface", "openai".`,
      );
  }
}
