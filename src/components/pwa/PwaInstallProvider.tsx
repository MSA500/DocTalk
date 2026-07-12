"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

// Not yet in lib.dom.d.ts — this is the real shape Chrome/Edge/Android dispatch.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

// "ios-manual": iOS Safari never fires beforeinstallprompt, so show manual
// instructions instead of a non-functional button.
export type PwaInstallState = "installable" | "ios-manual" | "installed" | "unavailable";

type PwaInstallContextValue = {
  state: PwaInstallState;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

// useSyncExternalStore (getServerSnapshot always false, matching SSR) avoids
// the hydration mismatch an effect + setState on mount would cause here.
function subscribeToDisplayMode(callback: () => void) {
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsStandaloneSnapshot(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function noSubscription() {
  return () => {};
}

function getIsIosSafariSnapshot(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /^((?!chrome|crios|fxios|android).)*safari/i.test(ua);
  return isIos && isSafari;
}

function getFalse() {
  return false;
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  const isStandalone = useSyncExternalStore(subscribeToDisplayMode, getIsStandaloneSnapshot, getFalse);
  const isIosSafari = useSyncExternalStore(noSubscription, getIsIosSafariSnapshot, getFalse);
  const installed = isStandalone || justInstalled;

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      // Suppress the browser's automatic prompt; app shows its own trigger instead.
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setJustInstalled(true);
      setDeferredEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return "unavailable" as const;
    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice;
    setDeferredEvent(null);
    if (choice.outcome === "accepted") setJustInstalled(true);
    return choice.outcome;
  }, [deferredEvent]);

  let state: PwaInstallState = "unavailable";
  if (installed) {
    state = "installed";
  } else if (deferredEvent) {
    state = "installable";
  } else if (isIosSafari) {
    state = "ios-manual";
  }

  return (
    <PwaInstallContext.Provider value={{ state, promptInstall }}>{children}</PwaInstallContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (!context) {
    throw new Error("usePwaInstall must be used within a PwaInstallProvider");
  }
  return context;
}
