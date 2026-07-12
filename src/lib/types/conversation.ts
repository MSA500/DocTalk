export type ConversationTurnRecord = {
  id: string;
  question: string;
  answer: string;
  referencedDocumentIds: string[];
  createdAt: string;
};

export type ConversationTurnRow = {
  id: string;
  session_id: string;
  question: string;
  answer: string;
  referenced_document_ids: string[];
  created_at: string;
};

export function toConversationTurnRecord(row: ConversationTurnRow): ConversationTurnRecord {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    referencedDocumentIds: row.referenced_document_ids,
    createdAt: row.created_at,
  };
}
