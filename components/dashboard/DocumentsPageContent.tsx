"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompactUploadBar } from "@/components/dashboard/CompactUploadBar";
import { DocumentLibrary } from "@/components/dashboard/DocumentLibrary";
import { HiddenFileInput } from "@/components/dashboard/HiddenFileInput";
import { useDocumentWorkspace } from "@/lib/hooks/useDocumentWorkspace";

export function DocumentsPageContent() {
  const { documents, handleFilesSelected, handleRemove, fileInputRef, openFilePicker, handleInputChange } =
    useDocumentWorkspace();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        All documents
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Everything you&apos;ve uploaded in this preview session.
      </p>

      <HiddenFileInput inputRef={fileInputRef} onChange={handleInputChange} />
      <CompactUploadBar
        onFilesSelected={handleFilesSelected}
        onBrowseClick={openFilePicker}
        className="mx-auto mt-8 max-w-lg"
      />

      <div className="mt-8">
        <DocumentLibrary documents={documents} onRemove={handleRemove} />
      </div>
    </div>
  );
}
