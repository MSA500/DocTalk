"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { KeyRound, Laptop, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";
import { useHasMounted } from "@/lib/hooks/useHasMounted";
import { siteConfig } from "@/lib/site-config";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function SettingsForm() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [voiceReplies, setVoiceReplies] = useState(false);

  return (
    <div className="space-y-10">
      <section aria-labelledby="profile-heading" className="rounded-2xl border border-border bg-surface p-6">
        <h2 id="profile-heading" className="text-lg font-semibold text-foreground">
          Profile
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Placeholder fields &mdash; account management arrives in a later
          phase.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-name" className="text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="settings-name"
              type="text"
              disabled
              placeholder="Jordan Rivera"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="settings-email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              disabled
              placeholder="jordan@example.com"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="appearance-heading" className="rounded-2xl border border-border bg-surface p-6">
        <h2 id="appearance-heading" className="text-lg font-semibold text-foreground">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {`Choose how ${siteConfig.name} looks on this device.`}
        </p>
        <div role="radiogroup" aria-labelledby="appearance-heading" className="mt-5 grid grid-cols-3 gap-3">
          {themeOptions.map((option) => {
            const isSelected = mounted && theme === option.value;
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

      <section aria-labelledby="notifications-heading" className="rounded-2xl border border-border bg-surface p-6">
        <h2 id="notifications-heading" className="text-lg font-semibold text-foreground">
          Notifications
        </h2>
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Email updates</p>
              <p className="text-sm text-muted-foreground">
                Get notified when a document finishes processing.
              </p>
            </div>
            <Switch checked={emailUpdates} onChange={setEmailUpdates} label="Toggle email updates" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Spoken replies</p>
              <p className="text-sm text-muted-foreground">
                Have the assistant read answers aloud by default.
              </p>
            </div>
            <Switch checked={voiceReplies} onChange={setVoiceReplies} label="Toggle spoken replies" />
          </div>
        </div>
      </section>

      <section aria-labelledby="integrations-heading" className="rounded-2xl border border-dashed border-border bg-surface/60 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-alt text-muted-foreground">
            <KeyRound aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <h2 id="integrations-heading" className="text-lg font-semibold text-foreground">
              API &amp; integrations
            </h2>
            <p className="text-sm text-muted-foreground">Coming in Phase 2.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
