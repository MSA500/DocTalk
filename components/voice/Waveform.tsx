"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BAR_COUNT = 24;

const BASE_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const wave = Math.sin((i / BAR_COUNT) * Math.PI);
  return 0.25 + wave * 0.65;
});

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
      {BASE_HEIGHTS.map((base, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className={cn(
            "w-1 rounded-full",
            active ? "bg-brand" : "bg-border",
          )}
          initial={false}
          animate={
            active
              ? {
                  height: [
                    `${base * 20}%`,
                    `${Math.min(100, base * 100)}%`,
                    `${base * 35}%`,
                    `${Math.min(100, base * 80)}%`,
                  ],
                }
              : { height: "12%" }
          }
          transition={
            active
              ? {
                  duration: 1.1 + (i % 5) * 0.12,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: (i % 6) * 0.06,
                }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}
