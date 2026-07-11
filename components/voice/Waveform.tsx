"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BAR_COUNT = 24;

const BASE_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const wave = Math.sin((i / BAR_COUNT) * Math.PI);
  return 0.25 + wave * 0.65;
});

// Hoisted to module scope so every bar's animate/transition object keeps the
// same reference across renders (they used to be created inline in JSX, so
// any re-render of a parent that renders <Waveform active /> — HeroPreview's
// prompt-cycling timer, VoiceCallOverlay's once-a-second call timer — handed
// Framer Motion a brand-new, if value-identical, animate target every time).
const ACTIVE_ANIMATE = BASE_HEIGHTS.map((base) => ({
  height: [
    `${base * 20}%`,
    `${Math.min(100, base * 100)}%`,
    `${base * 35}%`,
    `${Math.min(100, base * 80)}%`,
  ],
}));
const ACTIVE_TRANSITION = BASE_HEIGHTS.map((_, i) => ({
  duration: 1.1 + (i % 5) * 0.12,
  repeat: Infinity,
  ease: "easeInOut" as const,
  delay: (i % 6) * 0.06,
}));
const IDLE_ANIMATE = { height: "12%" };
const IDLE_TRANSITION = { duration: 0.3 };

type WaveformProps = {
  active?: boolean;
  className?: string;
};

export function Waveform({ active = false, className }: WaveformProps) {
  return (
    <div
      role="img"
      aria-label={active ? "Audio waveform, actively listening" : "Audio waveform, idle"}
      className={cn("flex h-16 items-center justify-center gap-1", className)}
    >
      {BASE_HEIGHTS.map((_, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className={cn(
            "w-1 rounded-full",
            active ? "bg-brand" : "bg-border",
          )}
          // No `initial` override here — deliberately. `initial={false}`
          // (the previous setting) skips Framer Motion's enter transition
          // entirely, and for an array-valued `animate.height` combined
          // with `repeat: Infinity`, that turned out to mean the bar just
          // snapped straight to the *last* keyframe and sat there forever
          // instead of ever starting the repeat loop — confirmed via CDP:
          // every bar frozen at its final keyframe value, unchanging across
          // 6+ seconds of sampling. Leaving `initial` unset lets Framer
          // Motion infer it from `animate`'s first keyframe on mount, which
          // is what actually kicks the loop off.
          animate={active ? ACTIVE_ANIMATE[i] : IDLE_ANIMATE}
          transition={active ? ACTIVE_TRANSITION[i] : IDLE_TRANSITION}
        />
      ))}
    </div>
  );
}
