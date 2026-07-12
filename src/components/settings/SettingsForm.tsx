"use client";

import { Moon, Smartphone, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { siteConfig } from "@/lib/site-config";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

export function SettingsForm() {
  const { theme, setTheme } = useTheme();
  const { state: pwaState } = usePwaInstall();

  return (
    <div className="space-y-10">
      <section aria-labelledby="appearance-heading" className="rounded-2xl border border-border bg-surface p-6">
        <h2 id="appearance-heading" className="text-lg font-semibold text-foreground">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {`Choose how ${siteConfig.name} looks on this device.`}
        </p>
        <div role="radiogroup" aria-labelledby="appearance-heading" className="mt-5 grid grid-cols-2 gap-3">
          {themeOptions.map((option) => {
            const isSelected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isSelected
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon aria-hidden="true" className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="app-heading" className="rounded-2xl border border-border bg-surface p-6">
        <h2 id="app-heading" className="text-lg font-semibold text-foreground">
          App
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {`Install ${siteConfig.name} on this device for quicker access.`}
        </p>
        <div className="mt-5">
          {pwaState === "installed" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Smartphone aria-hidden="true" className="h-5 w-5" />
              </div>
              <p>{siteConfig.name} is installed on this device.</p>
            </div>
          ) : pwaState === "unavailable" ? (
            <p className="text-sm text-muted-foreground">
              Installing isn&apos;t available in this browser yet — try Chrome or Edge on desktop or Android.
            </p>
          ) : (
            <InstallAppButton />
          )}
        </div>
      </section>
    </div>
  );
}
