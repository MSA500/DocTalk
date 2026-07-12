import type { SupabaseClient } from "@supabase/supabase-js";
import {
  toConversationTurnRecord,
  type ConversationTurnRecord,
  type ConversationTurnRow,
} from "@/lib/types/conversation";

export async function logConversationTurn(
  supabase: SupabaseClient,
  sessionId: string,
  question: string,
  answer: string,
  referencedDocumentIds: string[],
): Promise<void> {
  const { error } = await supabase.from("conversation_turns").insert({
    session_id: sessionId,
    question,
    answer,
    referenced_document_ids: referencedDocumentIds,
  });

  if (error) {
    throw new Error(`Could not save conversation turn: ${error.message}`);
  }
}

export async function getConversationHistory(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<ConversationTurnRecord[]> {
  const { data, error } = await supabase
    .from("conversation_turns")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load conversation history: ${error.message}`);
  }

  return ((data as ConversationTurnRow[]) ?? []).map(toConversationTurnRecord);
}
