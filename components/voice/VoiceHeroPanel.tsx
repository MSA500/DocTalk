"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Sparkles } from "lucide-react";
import { Waveform } from "@/components/voice/Waveform";
import { VoiceCallOverlay } from "@/components/voice/VoiceCallOverlay";

export function VoiceHeroPanel() {
  const [isCallOpen, setIsCallOpen] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-12 text-center sm:px-10 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
      >
        <div className="h-56 w-[36rem] rounded-full bg-brand/15 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
          Live preview &middot; sample data
        </div>

        <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Talk to DocTalk
        </h2>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Ask a question out loud and get a grounded answer from your
          documents, read back to you in real time.
        </p>

        <button
          type="button"
          onClick={() => setIsCallOpen(true)}
          className="group relative mt-2 flex h-24 w-24 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/30 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          aria-haspopup="dialog"
        >
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-brand/50"
            animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <Mic aria-hidden="true" className="relative h-9 w-9" />
        </button>

        <p className="text-sm font-semibold text-brand">Tap to start talking</p>

        <Waveform active={false} className="mt-2 w-full max-w-xs opacity-60" />
      </div>

      <AnimatePresence>
        {isCallOpen && <VoiceCallOverlay onClose={() => setIsCallOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
