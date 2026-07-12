"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, FileText, Loader2, MessageCircleQuestion, MessagesSquare } from "lucide-react";
import type { ConversationTurnRecord } from "@/lib/types/conversation";
import { formatRelativeTime } from "@/lib/utils";

type ConversationHistoryListProps = {
  turns: ConversationTurnRecord[];
  isLoading?: boolean;
  loadError?: string | null;
};

export function ConversationHistoryList({
  turns,
  isLoading = false,
  loadError = null,
}: ConversationHistoryListProps) {
  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-danger/30 py-12 text-center text-danger">
        <AlertCircle aria-hidden="true" className="h-8 w-8" />
        <p className="text-sm">{loadError}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading your conversation history&hellip;</p>
      </div>
    );
  }

  if (turns.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground"
      >
        <MessagesSquare aria-hidden="true" className="h-8 w-8" />
        <p className="text-sm">
          No conversations yet. Start a voice call to ask your documents a question.
        </p>
      </motion.div>
    );
  }

  // API returns chronological order (right for a live transcript); reverse
  // here since a browsable history reads better newest-on-top.
  const mostRecentFirst = [...turns].reverse();

  return (
    <ul className="flex flex-col gap-4">
      <AnimatePresence initial={false}>
        {mostRecentFirst.map((turn) => (
          <motion.li
            key={turn.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <MessageCircleQuestion aria-hidden="true" className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{turn.question}</p>
                <p className="mt-2 text-sm text-muted-foreground">{turn.answer}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(turn.createdAt)}</span>
                  {turn.referencedDocumentIds.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FileText aria-hidden="true" className="h-3 w-3" />
                      {turn.referencedDocumentIds.length === 1
                        ? "1 document referenced"
                        : `${turn.referencedDocumentIds.length} documents referenced`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
