"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type TypewriterProps = {
  text: string;
  speed?: number;
  startDelay?: number;
  className?: string;
  cursorClassName?: string;
  onComplete?: () => void;
};

export function Typewriter({
  text,
  speed = 28,
  startDelay = 0,
  className,
  cursorClassName,
  onComplete,
}: TypewriterProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [prevText, setPrevText] = useState(text);

  if (text !== prevText) {
    setPrevText(text);
    setVisibleCount(0);
    setIsDone(false);
  }

  useEffect(() => {
    let charTimer: ReturnType<typeof setInterval>;
    const startTimer = setTimeout(() => {
      let count = 0;
      charTimer = setInterval(() => {
        count += 1;
        setVisibleCount(count);
        if (count >= text.length) {
          clearInterval(charTimer);
          setIsDone(true);
          onComplete?.();
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      clearInterval(charTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, startDelay]);

  return (
    <span className={cn("inline", className)}>
      <span aria-hidden="true">
        {text.slice(0, visibleCount)}
        <span
          className={cn(
            "ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-current align-middle",
            !isDone && "animate-blink",
            cursorClassName,
          )}
        />
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
