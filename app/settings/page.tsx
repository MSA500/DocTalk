import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings/SettingsForm";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your DocTalk profile, appearance, and notification preferences.",
  alternates: {
    canonical: "/settings",
  },
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Settings
      </h1>
      <p className="mt-2 text-muted-foreground">
        A placeholder settings screen. Nothing here is persisted yet.
      </p>
      <div className="mt-10">
        <SettingsForm />
      </div>
    </div>
  );
}
