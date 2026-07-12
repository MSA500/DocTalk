"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BAR_COUNT = 24;

const BASE_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const wave = Math.sin((i / BAR_COUNT) * Math.PI);
  return 0.25 + wave * 0.65;
});

// Hoisted to module scope so animate/transition objects keep a stable
// reference across renders — inline JSX objects gave Framer Motion a new,
// value-identical animate target on every parent re-render (e.g. the call
// timer ticking once a second), restarting the animation each time.
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
          // No `initial` override, deliberately: `initial={false}` combined with
          // an array-valued `animate.height` + `repeat: Infinity` snaps the bar
          // straight to the last keyframe and never starts the loop (confirmed
          // via CDP). Leaving `initial` unset lets Framer Motion infer it from
          // `animate`'s first keyframe, which is what actually starts the loop.
          animate={active ? ACTIVE_ANIMATE[i] : IDLE_ANIMATE}
          transition={active ? ACTIVE_TRANSITION[i] : IDLE_TRANSITION}
        />
      ))}
    </div>
  );
}
