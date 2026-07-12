"use client";

import { useEffect, useState } from "react";
import type { ConversationTurnRecord } from "@/lib/types/conversation";

// Module-scoped so it survives template.tsx remounting this hook's
// component on every navigation — see the identical pattern (and rationale)
// in useDocumentWorkspace.ts.
let turnsCache: ConversationTurnRecord[] | null = null;

export function useConversationHistory() {
  const [turns, setTurns] = useState<ConversationTurnRecord[]>(() => turnsCache ?? []);
  const [isLoading, setIsLoading] = useState(() => turnsCache === null);
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
        const turns = body.turns ?? [];
        turnsCache = turns;
        setTurns(turns);
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
