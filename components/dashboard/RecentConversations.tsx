"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, MessageCircleQuestion, MessagesSquare } from "lucide-react";
import { useConversationHistory } from "@/lib/hooks/useConversationHistory";
import { formatRelativeTime } from "@/lib/utils";

const PREVIEW_COUNT = 3;

export function RecentConversations() {
  const { turns, isLoading, loadError } = useConversationHistory();
  const recentTurns = [...turns].reverse().slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-danger/30 py-8 text-center text-danger">
          <AlertCircle aria-hidden="true" className="h-6 w-6" />
          <p className="text-sm">{loadError}</p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading recent conversations&hellip;</p>
        </div>
      ) : recentTurns.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center text-muted-foreground"
        >
          <MessagesSquare aria-hidden="true" className="h-6 w-6" />
          <p className="text-sm">No conversations yet.</p>
        </motion.div>
      ) : (
        <ul className="flex flex-col gap-2">
          {recentTurns.map((turn) => (
            <li key={turn.id}>
              <Link
                href="/dashboard/history"
                className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <MessageCircleQuestion
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{turn.question}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(turn.createdAt)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
