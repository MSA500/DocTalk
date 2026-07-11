"use client";

import { motion } from "framer-motion";
import { Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoicePhase } from "@/lib/voice-phase";

const ringVariants = {
  animate: {
    scale: [1, 1.6, 1.9],
    opacity: [0.45, 0.15, 0],
  },
};

export function MicButton({ phase }: { phase: VoicePhase }) {
  const isListening = phase === "listening";
  const isThinking = phase === "thinking" || phase === "connecting";

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      {isListening &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-brand/40"
            variants={ringVariants}
            animate="animate"
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
              delay: i * 0.6,
            }}
          />
        ))}
      <motion.div
        aria-hidden="true"
        animate={isListening ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={
          isListening
            ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-colors",
          isListening ? "bg-brand text-brand-foreground" : "bg-surface-alt text-muted-foreground",
        )}
      >
        {isThinking ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </motion.div>
    </div>
  );
}
