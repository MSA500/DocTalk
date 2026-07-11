"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ConversationHistoryList } from "@/components/dashboard/ConversationHistoryList";
import { useConversationHistory } from "@/lib/hooks/useConversationHistory";

export function HistoryPageContent() {
  const { turns, isLoading, loadError } = useConversationHistory();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Conversation history
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Every question you&apos;ve asked DocTalk in this session, most recent first.
      </p>

      <div className="mt-8">
        <ConversationHistoryList turns={turns} isLoading={isLoading} loadError={loadError} />
      </div>
    </div>
  );
}
