"use client";

import { VoiceCallOverlay } from "@/components/voice/VoiceCallOverlay";

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

// Dedicated, chrome-free route for embedding the voice call experience
// inside a host app's WebView (see DocTalk Mobile's Phase 2 voice
// architecture). Not intended for direct browser navigation — the overlay
// opens immediately on load. Its own close/hang-up controls also notify
// the WebView host via window.ReactNativeWebView.postMessage, so the host
// can dismiss its native modal chrome in sync with this page's own UI.
// Safe to load in a normal browser tab too — the postMessage call becomes
// a harmless no-op there, since window.ReactNativeWebView won't exist.
export default function VoiceEmbedPage() {
  const handleClose = () => {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "close" }));
  };

  const handleError = (message: string) => {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "error", message }));
  };

  return (
    <VoiceCallOverlay onClose={handleClose} onError={handleError} showHeaderCloseButton={false} />
  );
}
