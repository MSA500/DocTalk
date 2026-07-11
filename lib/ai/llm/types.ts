export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface LLMProvider {
  readonly model: string;
  complete(messages: ChatMessage[]): Promise<string>;
  stream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown>;
}

export class LLMConfigError extends Error {}
