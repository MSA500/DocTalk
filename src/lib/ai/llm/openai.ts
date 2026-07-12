import { createOpenAICompatibleProvider, requireApiKey } from "@/lib/ai/llm/openai-compatible";
import type { LLMProvider } from "@/lib/ai/llm/types";

const DEFAULT_MODEL = "gpt-4o-mini";

export function createOpenAIProvider(): LLMProvider {
  const apiKey = requireApiKey(process.env.LLM_API_KEY, "OpenAI", "openai");
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  return createOpenAICompatibleProvider({
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    model,
    providerLabel: "OpenAI",
  });
}
