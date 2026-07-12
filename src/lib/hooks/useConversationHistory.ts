"use client";

import { useEffect, useState } from "react";
import type { ConversationTurnRecord } from "@/lib/types/conversation";

export function useConversationHistory() {
  const [turns, setTurns] = useState<ConversationTurnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const response = await fetch("/api/conversations");
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(body?.error?.message || "Couldn't load conversation history.");
        }
        setTurns(body.turns ?? []);
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  return { turns, isLoading, loadError };
}
