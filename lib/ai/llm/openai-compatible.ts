import { LLMConfigError, type ChatMessage, type LLMProvider } from "@/lib/ai/llm/types";

type CreateOpenAICompatibleProviderOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerLabel: string;
};

// Groq and OpenAI both speak the same chat/completions wire format, so this
// one implementation backs both lib/ai/llm/groq.ts and lib/ai/llm/openai.ts.
export function createOpenAICompatibleProvider({
  apiKey,
  baseUrl,
  model,
  providerLabel,
}: CreateOpenAICompatibleProviderOptions): LLMProvider {
  async function requestCompletion(messages: ChatMessage[], stream: boolean) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream, temperature: 0.3 }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`${providerLabel} completion request failed (${response.status}): ${errorBody.slice(0, 300)}`);
    }

    return response;
  }

  return {
    model,

    async complete(messages) {
      const response = await requestCompletion(messages, false);
      const data: unknown = await response.json();
      const content = (
        data as { choices?: { message?: { content?: string } }[] }
      ).choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error(`Unrecognized completion response shape from ${providerLabel}.`);
      }
      return content;
    },

    async *stream(messages) {
      const response = await requestCompletion(messages, true);
      if (!response.body) {
        throw new Error(`${providerLabel} returned a streaming response with no body.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice("data:".length).trim();
            if (payload === "[DONE]") return;

            let parsed: unknown;
            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }
            const delta = (
              parsed as { choices?: { delta?: { content?: string } }[] }
            ).choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              yield delta;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

export function requireApiKey(envValue: string | undefined, providerLabel: string, providerFlag: string): string {
  if (!envValue) {
    throw new LLMConfigError(`LLM_API_KEY is required when LLM_PROVIDER=${providerFlag} (using ${providerLabel}).`);
  }
  return envValue;
}
