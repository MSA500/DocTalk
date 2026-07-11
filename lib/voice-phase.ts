export type VoicePhase = "connecting" | "listening" | "thinking" | "answering" | "pause";

export const PHASE_LABEL: Record<VoicePhase, string> = {
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking",
  answering: "Answering",
  pause: "Answered",
};

export const LISTENING_MS = 2200;
export const THINKING_MS = 900;
export const PAUSE_MS = 2600;
