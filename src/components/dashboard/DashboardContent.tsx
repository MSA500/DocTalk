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

  // Mobile (<sm) uses `order-*` to stack sections as Voice -> Upload ->
  // Document Library -> Recent Conversations. `sm:order-none` resets to DOM
  // order for tablet, and the `lg:` column/row placement rebuilds the desktop
  // two-column layout — both unchanged from before.
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <HiddenFileInput inputRef={fileInputRef} onChange={handleInputChange} />

      <section
        aria-label="Voice assistant"
        id="voice-assistant"
        className="order-1 sm:order-none lg:col-span-2 lg:col-start-1 lg:row-start-1"
      >
        <VoiceHeroPanel />
      </section>

      {/* Mobile-only upload entry point (the Document Library section below has
          its own copy visible from sm: up — only one is ever reachable). */}
      <div className="order-2 sm:hidden">
        <h2 className="sr-only">Upload documents</h2>
        <CompactUploadBar onFilesSelected={handleFilesSelected} onBrowseClick={openFilePicker} />
      </div>

      {/* DOM order is Voice, Upload, Recent, Document Library so that tablet
          (sm:order-none, single column) keeps its original stacking. Mobile
          overrides with order-* to put Document Library (order-3) above Recent
          Conversations (order-4); desktop uses explicit lg column/row placement. */}
      <section
        aria-labelledby="recent-conversations-heading"
        id="recent-conversations"
        className="order-4 sm:order-none lg:col-span-2 lg:col-start-1 lg:row-start-2"
      >
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

      <section
        aria-labelledby="document-library-heading"
        id="document-library"
        className="order-3 sm:order-none lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24 lg:self-start"
      >
        <h2 id="document-library-heading" className="sr-only">
          Document library
        </h2>

        <div className="hidden sm:block">
          <CompactUploadBar onFilesSelected={handleFilesSelected} onBrowseClick={openFilePicker} />
        </div>

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
  );
}
