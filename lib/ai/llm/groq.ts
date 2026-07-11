import { createOpenAICompatibleProvider, requireApiKey } from "@/lib/ai/llm/openai-compatible";
import type { LLMProvider } from "@/lib/ai/llm/types";

// openai/gpt-oss-120b is Groq's own recommended general-purpose model as of
// this build — llama-3.3-70b-versatile and llama-3.1-8b-instant (the more
// commonly-referenced defaults in older docs/tutorials) are both scheduled
// for deprecation on 2026-08-16, so a fresh default deliberately avoids
// them. 500 tokens/sec also makes it a good fit for voice latency. Override
// via LLM_MODEL if needed.
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
