"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MicButton } from "@/components/voice/MicButton";
import { Waveform } from "@/components/voice/Waveform";
import { Typewriter } from "@/components/ui/Typewriter";
import { demoExchanges } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type VoicePhase = "listening" | "thinking" | "answering" | "pause";

const PHASE_LABEL: Record<VoicePhase, string> = {
  listening: "Listening",
  thinking: "Thinking",
  answering: "Answering",
  pause: "Answered",
};

const LISTENING_MS = 2200;
const THINKING_MS = 900;
const PAUSE_MS = 2600;

export function VoiceAssistantDemo() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<VoicePhase>("listening");
  const exchange = demoExchanges[index];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (phase === "listening") {
      timer = setTimeout(() => setPhase("thinking"), LISTENING_MS);
    } else if (phase === "thinking") {
      timer = setTimeout(() => setPhase("answering"), THINKING_MS);
    } else if (phase === "pause") {
      timer = setTimeout(() => {
        setIndex((i) => (i + 1) % demoExchanges.length);
        setPhase("listening");
      }, PAUSE_MS);
    }

    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex items-center gap-2 self-start rounded-full bg-surface-alt px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-brand" />
        Live preview &middot; sample data
      </div>

      <MicButton phase={phase} />

      <p aria-live="polite" className="text-sm font-medium text-muted-foreground">
        {PHASE_LABEL[phase]}
        <span className="sr-only"> — demo voice assistant status</span>
      </p>

      <Waveform active={phase === "listening"} className="w-full max-w-sm" />

      <div className="w-full space-y-4 text-left">
        <AnimatePresence mode="wait">
          <motion.div
            key={`question-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl bg-surface-alt px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              You asked
            </p>
            <p className="mt-1 text-sm text-foreground">{exchange.question}</p>
          </motion.div>
        </AnimatePresence>

        <div
          className={cn(
            "min-h-[92px] rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 transition-opacity",
            phase === "answering" || phase === "pause"
              ? "opacity-100"
              : "opacity-40",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            DocTalk answers
          </p>
          <p className="mt-1 text-sm text-foreground">
            {(phase === "answering" || phase === "pause") && (
              <Typewriter
                key={`answer-${index}`}
                text={exchange.answer}
                speed={20}
                onComplete={() => setPhase("pause")}
              />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
