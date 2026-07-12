export type ConfigStatus = {
  supabaseConfigured: boolean;
  embeddingConfigured: boolean;
  llmConfigured: boolean;
  vapiConfigured: boolean;
};

export function getConfigStatus(): ConfigStatus {
  return {
    supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    embeddingConfigured: !!process.env.EMBEDDING_API_KEY,
    llmConfigured: !!process.env.LLM_API_KEY,
    vapiConfigured: !!(process.env.VAPI_PUBLIC_KEY && process.env.VAPI_ASSISTANT_ID),
  };
}

// Every piece must be configured for a live voice call to work end to end —
// if any one is missing, the voice overlay falls back to demo mode.
export function isFullyConfiguredForVoice(status: ConfigStatus): boolean {
  return status.supabaseConfigured && status.embeddingConfigured && status.llmConfigured && status.vapiConfigured;
}
