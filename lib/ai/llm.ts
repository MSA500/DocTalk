import { createGroqProvider } from "@/lib/ai/llm/groq";
import { createOpenAIProvider } from "@/lib/ai/llm/openai";
import { LLMConfigError, type LLMProvider } from "@/lib/ai/llm/types";

export type { ChatMessage, LLMProvider } from "@/lib/ai/llm/types";
export { LLMConfigError } from "@/lib/ai/llm/types";

export function getLLMProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || "groq").toLowerCase();

  switch (provider) {
    case "groq":
      return createGroqProvider();
    case "openai":
      return createOpenAIProvider();
    default:
      throw new LLMConfigError(`Unknown LLM_PROVIDER "${provider}". Supported values: "groq", "openai".`);
  }
}
