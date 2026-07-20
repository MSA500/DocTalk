"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { useToast } from "@/components/ui/ToastProvider";
import { demoExchanges } from "@/lib/mock-data";
import { LISTENING_MS, PAUSE_MS, THINKING_MS, type VoicePhase } from "@/lib/voice-phase";

export type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ConfigStatusResponse = {
  demoMode: boolean;
  vapiPublicKey: string | null;
  vapiAssistantId: string | null;
};

type VapiTranscriptMessage = {
  type: string;
  role?: "user" | "assistant" | "system";
  transcriptType?: "partial" | "final";
  transcript?: string;
};

function randomId(role: string) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Runs one of two modes behind the same returned interface: a real Vapi
// call routed through /api/vapi/chat/completions, or a canned demo loop
// used whenever Supabase/embedding/LLM/Vapi aren't all fully configured
// (see GET /api/config/status) — so the app degrades to an obvious demo
// instead of a broken real call.
export function useVoiceCall(onClose: () => void, onError?: (message: string) => void) {
  const { showToast } = useToast();

  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [phase, setPhase] = useState<VoicePhase>("connecting");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [demoIndex, setDemoIndex] = useState(0);

  const vapiRef = useRef<Vapi | null>(null);
  const isMountedRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);
  const hadErrorRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  function appendMessage(role: "user" | "assistant", text: string) {
    if (!isMountedRef.current) return;
    setTranscript((prev) => [...prev, { id: randomId(role), role, text }]);
  }

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    async function init() {
      let status: ConfigStatusResponse;
      try {
        const res = await fetch("/api/config/status");
        status = await res.json();
      } catch {
        if (cancelled) return;
        setIsDemoMode(true);
        setIsLoadingConfig(false);
        setPhase("listening");
        return;
      }
      if (cancelled) return;

      if (status.demoMode || !status.vapiPublicKey || !status.vapiAssistantId) {
        setIsDemoMode(true);
        setIsLoadingConfig(false);
        setPhase("listening");
        return;
      }

      setIsLoadingConfig(false);

      // Preload this session's past turns so reopening the overlay shows
      // real history, not an empty transcript. Non-critical: if it fails,
      // the call still proceeds with an empty transcript.
      try {
        const historyRes = await fetch("/api/conversations");
        const historyBody = await historyRes.json();
        if (!cancelled && Array.isArray(historyBody?.turns)) {
          const historyMessages: TranscriptMessage[] = [];
          for (const turn of historyBody.turns as { id: string; question: string; answer: string }[]) {
            historyMessages.push({ id: `${turn.id}-q`, role: "user", text: turn.question });
            historyMessages.push({ id: `${turn.id}-a`, role: "assistant", text: turn.answer });
          }
          setTranscript(historyMessages);
        }
      } catch {}

      try {
        const prepareRes = await fetch("/api/voice/prepare-call", { method: "POST" });
        const prepareBody = await prepareRes.json();
        if (!prepareRes.ok || !prepareBody?.callToken) {
          throw new Error(prepareBody?.error?.message || "Could not prepare the call.");
        }
        if (cancelled) return;

        const vapi = new Vapi(status.vapiPublicKey as string);
        vapiRef.current = vapi;

        vapi.on("call-start", () => {
          if (isMountedRef.current) setPhase("listening");
        });
        vapi.on("call-end", () => {
          if (!isMountedRef.current) return;
          if (hadErrorRef.current && onErrorRef.current) {
            onErrorRef.current("The voice call ended unexpectedly. Please try again.");
          } else {
            onCloseRef.current();
          }
        });
        vapi.on("error", (err) => {
          console.error("Vapi call error:", err);
          hadErrorRef.current = true;
          if (!isMountedRef.current) return;
          showToast({
            variant: "error",
            title: "Call error",
            description: "Something went wrong with the voice call.",
          });
        });
        vapi.on("message", (message: unknown) => {
          if (!isMountedRef.current) return;
          const m = message as VapiTranscriptMessage;
          if (m.type !== "transcript" || m.transcriptType !== "final" || !m.transcript) return;
          if (m.role === "user") {
            appendMessage("user", m.transcript);
            setPhase("thinking");
          } else if (m.role === "assistant") {
            appendMessage("assistant", m.transcript);
            setPhase("answering");
          }
        });

        // model.url is set to this page's own origin so the same assistant
        // config works across local/staging/production. The call token (see
        // /api/voice/prepare-call) is sent via both metadata and a header,
        // since only one is well-documented as reaching the custom-LLM
        // request; the server checks both (/api/vapi/chat/completions).
        await vapi.start(status.vapiAssistantId as string, {
          metadata: { callToken: prepareBody.callToken as string },
          model: {
            provider: "custom-llm",
            model: "doctalk-rag",
            url: `${window.location.origin}/api/vapi`,
            headers: { "x-doctalk-call-token": prepareBody.callToken as string },
          },
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to start voice call:", err);
        setConnectionError((err as Error).message || "Could not start the call.");
        onErrorRef.current?.("The voice call couldn't start. Please try again.");
        showToast({
          variant: "error",
          title: "Couldn't start the call",
          description: (err as Error).message || "Please try again.",
        });
      }
    }

    init();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      vapiRef.current?.stop().catch(() => {});
      vapiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isDemoMode) return;
    const timer = setTimeout(() => {
      appendMessage("user", demoExchanges[demoIndex].question);
    }, 0);
    return () => clearTimeout(timer);
  }, [isDemoMode, demoIndex]);

  useEffect(() => {
    if (!isDemoMode || phase !== "answering") return;
    const timer = setTimeout(() => {
      appendMessage("assistant", demoExchanges[demoIndex].answer);
    }, 0);
    return () => clearTimeout(timer);
  }, [isDemoMode, phase, demoIndex]);

  useEffect(() => {
    if (!isDemoMode || isMuted) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (phase === "connecting") {
      timer = setTimeout(() => setPhase("listening"), 500);
    } else if (phase === "listening") {
      timer = setTimeout(() => setPhase("thinking"), LISTENING_MS);
    } else if (phase === "thinking") {
      timer = setTimeout(() => setPhase("answering"), THINKING_MS);
    } else if (phase === "pause") {
      timer = setTimeout(() => {
        setDemoIndex((i) => (i + 1) % demoExchanges.length);
        setPhase("listening");
      }, PAUSE_MS);
    }
    return () => clearTimeout(timer);
  }, [isDemoMode, phase, isMuted]);

  function toggleMute() {
    if (isDemoMode) {
      setIsMuted((m) => !m);
      return;
    }
    const next = !isMuted;
    vapiRef.current?.setMuted(next);
    setIsMuted(next);
  }

  function hangUp() {
    if (!isDemoMode) {
      vapiRef.current?.stop().catch(() => {});
    }
    onClose();
  }

  // Demo mode pauses before looping to the next canned question; real mode
  // returns straight to listening since the user decides when to speak next.
  function handleAnswerTypewriterComplete() {
    setPhase(isDemoMode ? "pause" : "listening");
  }

  return {
    isLoadingConfig,
    isDemoMode,
    connectionError,
    phase,
    transcript,
    isMuted,
    toggleMute,
    hangUp,
    handleAnswerTypewriterComplete,
  };
}
