"use client";

import { Download, Share } from "lucide-react";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";

type InstallAppButtonProps = {
  variant?: "full" | "compact";
  className?: string;
};

// Renders nothing when there's genuinely nothing to offer (already
// installed, or a desktop browser that hasn't fired beforeinstallprompt and
// isn't iOS Safari) — this is a manual trigger point, not a nag, so it only
// ever shows up when there's a real action available.
export function InstallAppButton({ variant = "full", className }: InstallAppButtonProps) {
  const { state, promptInstall } = usePwaInstall();
  const { showToast } = useToast();

  if (state === "installed" || state === "unavailable") return null;

  if (state === "ios-manual") {
    if (variant === "compact") return null;
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-dashed border-border bg-surface-alt/60 p-4 text-sm text-muted-foreground",
          className,
        )}
      >
        <Share aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p>
          To install DocTalk on this device, tap the Share button in Safari,
          then choose <span className="font-medium text-foreground">Add to Home Screen</span>.
        </p>
      </div>
    );
  }

  async function handleClick() {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      showToast({
        variant: "success",
        title: "Installing DocTalk",
        description: "DocTalk is being added to your device.",
      });
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Install DocTalk app"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
      >
        <Download aria-hidden="true" className="h-4.5 w-4.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Download aria-hidden="true" className="h-4 w-4" />
      Install App
    </button>
  );
}
