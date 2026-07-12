"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AlertTriangle, Loader2, Mic, MicOff, PhoneOff, X } from "lucide-react";
import { MicButton } from "@/components/voice/MicButton";
import { Waveform } from "@/components/voice/Waveform";
import { Typewriter } from "@/components/ui/Typewriter";
import { useVoiceCall } from "@/lib/hooks/useVoiceCall";
import { PHASE_LABEL } from "@/lib/voice-phase";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VoiceCallOverlay({ onClose }: { onClose: () => void }) {
  const {
    isDemoMode,
    connectionError,
    phase,
    transcript,
    isMuted,
    toggleMute,
    hangUp,
    handleAnswerTypewriterComplete,
  } = useVoiceCall(onClose);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hangUp();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-pins scroll on any content resize, including mid-typewriter growth.
  useEffect(() => {
    const content = contentRef.current;
    const scrollEl = scrollRef.current;
    if (!content || !scrollEl) return;
    const observer = new ResizeObserver(() => {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const statusLabel = isMuted ? "Muted" : PHASE_LABEL[phase];

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Voice call with DocTalk"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-full w-full flex-col bg-background outline-none sm:h-[92vh] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-border sm:shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={hangUp}
            aria-label="Close voice call"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            {isDemoMode && (
              <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Demo mode
              </span>
            )}
            <p className="text-sm font-medium tabular-nums text-muted-foreground">
              {formatDuration(elapsedSeconds)}
            </p>
          </div>
        </header>

        <div className="flex flex-col items-center gap-3 border-b border-border px-5 py-6">
          <MicButton phase={isMuted ? "pause" : phase} />
          <p aria-live="polite" className="text-sm font-semibold text-foreground">
            {statusLabel}
            <span className="sr-only"> — voice call status</span>
          </p>
          <Waveform active={!isMuted && phase === "listening"} className="w-full max-w-xs" />
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          <div ref={contentRef} className="mx-auto flex max-w-lg flex-col gap-3">
            {connectionError && (
              <div className="flex items-start gap-1.5 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-xs text-danger">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{connectionError}</span>
              </div>
            )}
            {transcript.length === 0 && !connectionError && (
              <p className="text-center text-sm text-muted-foreground">
                Say something to get started&hellip;
              </p>
            )}
            {transcript.map((message, i) => {
              const isLast = i === transcript.length - 1;
              const isActivelyTyping = isLast && message.role === "assistant" && phase === "answering";
              return (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      message.role === "user"
                        ? "bg-brand text-brand-foreground"
                        : "bg-surface-alt text-foreground",
                    )}
                  >
                    {isActivelyTyping ? (
                      <Typewriter text={message.text} speed={20} onComplete={handleAnswerTypewriterComplete} />
                    ) : (
                      message.text
                    )}
                  </div>
                </div>
              );
            })}
            {phase === "thinking" && !isMuted && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl bg-surface-alt px-4 py-3">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="sr-only">DocTalk is thinking</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 border-t border-border px-5 py-5">
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={isMuted}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isMuted
                ? "border-transparent bg-surface-alt text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {isMuted ? (
              <MicOff aria-hidden="true" className="h-5 w-5" />
            ) : (
              <Mic aria-hidden="true" className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={hangUp}
            aria-label="End call"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PhoneOff aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
