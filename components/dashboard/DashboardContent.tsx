"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CompactUploadBar } from "@/components/dashboard/CompactUploadBar";
import { DocumentLibrary } from "@/components/dashboard/DocumentLibrary";
import { HiddenFileInput } from "@/components/dashboard/HiddenFileInput";
import { RecentConversations } from "@/components/dashboard/RecentConversations";
import { VoiceHeroPanel } from "@/components/voice/VoiceHeroPanel";
import { useDocumentWorkspace } from "@/lib/hooks/useDocumentWorkspace";

export function DashboardContent() {
  const {
    documents,
    isLoading,
    loadError,
    handleFilesSelected,
    handleRemove,
    fileInputRef,
    openFilePicker,
    handleInputChange,
  } = useDocumentWorkspace();

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <HiddenFileInput inputRef={fileInputRef} onChange={handleInputChange} />

      <div className="space-y-6 lg:col-span-2">
        <section aria-label="Voice assistant" id="voice-assistant">
          <VoiceHeroPanel />
        </section>

        <section aria-labelledby="recent-conversations-heading" id="recent-conversations">
          <div>
            <h2 id="recent-conversations-heading" className="text-xl font-semibold text-foreground">
              Recent conversations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your last few questions in this session.
            </p>
          </div>

          <Link
            href="/dashboard/history"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View all history
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>

          <div className="mt-4">
            <RecentConversations />
          </div>
        </section>
      </div>

      <div className="lg:col-span-1">
        <section aria-labelledby="document-library-heading" id="document-library" className="lg:sticky lg:top-24">
          <h2 id="document-library-heading" className="sr-only">
            Document library
          </h2>

          <CompactUploadBar onFilesSelected={handleFilesSelected} onBrowseClick={openFilePicker} />

          <div className="mt-4">
            <DocumentLibrary
              documents={documents}
              onRemove={handleRemove}
              containScroll
              isLoading={isLoading}
              loadError={loadError}
            />
          </div>

          <Link
            href="/dashboard/documents"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View more
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>
    </div>
  );
}
