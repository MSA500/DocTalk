"use client";

import Link from "next/link";
import { ArrowRight, UploadCloud } from "lucide-react";
import { CompactUploadBar } from "@/components/dashboard/CompactUploadBar";
import { DocumentLibrary } from "@/components/dashboard/DocumentLibrary";
import { HiddenFileInput } from "@/components/dashboard/HiddenFileInput";
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

        <section aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="sr-only">
            Upload documents
          </h2>
          <CompactUploadBar onFilesSelected={handleFilesSelected} onBrowseClick={openFilePicker} />
        </section>
      </div>

      <div className="lg:col-span-1">
        <section aria-labelledby="document-library-heading" id="document-library" className="lg:sticky lg:top-24">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="document-library-heading" className="text-xl font-semibold text-foreground">
                Document library
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything you&apos;ve uploaded in this preview session.
              </p>
            </div>
            <button
              type="button"
              onClick={openFilePicker}
              aria-label="Browse documents to upload"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <UploadCloud aria-hidden="true" className="h-3.5 w-3.5" />
              Browse
            </button>
          </div>

          <Link
            href="/dashboard/documents"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View more
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>

          <div className="mt-4">
            <DocumentLibrary
              documents={documents}
              onRemove={handleRemove}
              containScroll
              isLoading={isLoading}
              loadError={loadError}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
