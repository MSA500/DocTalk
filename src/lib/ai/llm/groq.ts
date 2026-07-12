import { createOpenAICompatibleProvider, requireApiKey } from "@/lib/ai/llm/openai-compatible";
import type { LLMProvider } from "@/lib/ai/llm/types";

// llama-3.3-70b-versatile and llama-3.1-8b-instant are scheduled for Groq
// deprecation on 2026-08-16 — this default avoids them. Override via LLM_MODEL.
const DEFAULT_MODEL = "openai/gpt-oss-120b";

export function createGroqProvider(): LLMProvider {
  const apiKey = requireApiKey(process.env.LLM_API_KEY, "Groq", "groq");
  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  return createOpenAICompatibleProvider({
    apiKey,
    baseUrl: "https://api.groq.com/openai/v1",
    model,
    providerLabel: "Groq",
  });
}
