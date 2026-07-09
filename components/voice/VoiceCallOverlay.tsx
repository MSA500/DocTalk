"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Loader2, Mic, MicOff, PhoneOff, X } from "lucide-react";
import { MicButton } from "@/components/voice/MicButton";
import { Waveform } from "@/components/voice/Waveform";
import { Typewriter } from "@/components/ui/Typewriter";
import { demoExchanges } from "@/lib/mock-data";
import { LISTENING_MS, PAUSE_MS, PHASE_LABEL, THINKING_MS, type VoicePhase } from "@/lib/voice-phase";
import { cn } from "@/lib/utils";

type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function VoiceCallOverlay({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<VoicePhase>("listening");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock background scroll while the call is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus the panel on open so screen readers announce the dialog.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Call duration timer.
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Add the user's question bubble once per exchange.
  useEffect(() => {
    const timer = setTimeout(() => {
      setTranscript((prev) => [
        ...prev,
        { id: `user-${index}`, role: "user", text: demoExchanges[index].question },
      ]);
    }, 0);
    return () => clearTimeout(timer);
  }, [index]);

  // Add the assistant's answer bubble once per exchange, right as "answering" begins.
  useEffect(() => {
    if (phase !== "answering") return;
    const timer = setTimeout(() => {
      setTranscript((prev) => [
        ...prev,
        { id: `assistant-${index}`, role: "assistant", text: demoExchanges[index].answer },
      ]);
    }, 0);
    return () => clearTimeout(timer);
  }, [phase, index]);

  // Phase state machine — paused while muted.
  useEffect(() => {
    if (isMuted) return;
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
  }, [phase, isMuted]);

  // Keep transcript pinned to the latest message, including while it's still being typed.
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
            onClick={onClose}
            aria-label="Close voice call"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            {formatDuration(elapsedSeconds)}
          </p>
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
            {transcript.length === 0 && (
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
                      <Typewriter text={message.text} speed={20} onComplete={() => setPhase("pause")} />
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
            onClick={() => setIsMuted((m) => !m)}
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
            onClick={onClose}
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
