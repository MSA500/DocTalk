import type { Metadata } from "next";
import { DocumentWorkspace } from "@/components/dashboard/DocumentWorkspace";
import { VoiceAssistantDemo } from "@/components/voice/VoiceAssistantDemo";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Upload documents, browse your library, and preview the DocTalk voice assistant.",
  alternates: {
    canonical: "/dashboard",
  },
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          This is a static preview of the {siteConfig.name} dashboard. Upload
          and document processing shown here are simulated for Phase 1.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section aria-labelledby="upload-heading">
            <h2
              id="upload-heading"
              className="text-xl font-semibold text-foreground"
            >
              Upload documents
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Files are processed locally in this preview &mdash; nothing is
              uploaded to a server yet.
            </p>
            <div className="mt-4" id="document-library">
              <DocumentWorkspace />
            </div>
          </section>
        </div>

        <div className="lg:col-span-1">
          <section aria-labelledby="voice-assistant-heading" id="voice-assistant" className="lg:sticky lg:top-24">
            <h2
              id="voice-assistant-heading"
              className="text-xl font-semibold text-foreground"
            >
              Voice assistant
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A looping preview of what asking DocTalk a question will feel
              like.
            </p>
            <div className="mt-4">
              <VoiceAssistantDemo />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
