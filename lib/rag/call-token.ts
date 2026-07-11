import type { SupabaseClient } from "@supabase/supabase-js";

// Tokens aren't explicitly deleted after use (a voice call can legitimately
// make several requests to /api/vapi/chat/completions over its lifetime,
// one per question), so instead of a single-use/expiring row, anything
// older than this is just treated as invalid on lookup — sufficient at this
// scale without a scheduled cleanup job.
const CALL_TOKEN_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export async function createCallToken(supabase: SupabaseClient, sessionId: string): Promise<string> {
  const { data, error } = await supabase
    .from("voice_call_tokens")
    .insert({ session_id: sessionId })
    .select("call_token")
    .single();

  if (error || !data) {
    throw new Error(`Could not create a call token: ${error?.message ?? "unknown error"}`);
  }

  return (data as { call_token: string }).call_token;
}

export async function resolveCallToken(supabase: SupabaseClient, callToken: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("voice_call_tokens")
    .select("session_id, created_at")
    .eq("call_token", callToken)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { session_id: string; created_at: string };
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > CALL_TOKEN_MAX_AGE_MS) return null;

  return row.session_id;
}
