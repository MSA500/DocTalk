"use client";

import { useCallback, useState } from "react";
import { Mic } from "lucide-react";
import { Waveform } from "@/components/voice/Waveform";
import { Typewriter } from "@/components/ui/Typewriter";

const PROMPTS = [
  "What's our refund policy?",
  "Summarize the Q3 report.",
  "Any risks flagged in the contract?",
];

export function HeroPreview() {
  const [index, setIndex] = useState(0);

  const handleComplete = useCallback(() => {
    setTimeout(() => {
      setIndex((i) => (i + 1) % PROMPTS.length);
    }, 2000);
  }, []);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl shadow-brand/5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
          <Mic aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ask DocTalk
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            <Typewriter key={index} text={PROMPTS[index]} speed={32} onComplete={handleComplete} />
          </p>
        </div>
      </div>
      <Waveform active className="mt-4" />
    </div>
  );
}
