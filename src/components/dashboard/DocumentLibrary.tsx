"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, FolderOpen, Loader2 } from "lucide-react";
import type { DisplayDocument } from "@/lib/hooks/useDocumentWorkspace";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

type LibraryFilter = "all" | "processing";

const FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All documents" },
  { value: "processing", label: "In progress" },
];

type DocumentLibraryProps = {
  documents: DisplayDocument[];
  onRemove: (id: string) => void;
  containScroll?: boolean;
  isLoading?: boolean;
  loadError?: string | null;
};

export function DocumentLibrary({
  documents,
  onRemove,
  containScroll = false,
  isLoading = false,
  loadError = null,
}: DocumentLibraryProps) {
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; filename: string } | null>(null);

  const visibleDocuments = useMemo(
    () =>
      filter === "processing"
        ? documents.filter(
            (doc) => doc.status === "uploading" || doc.status === "extracting" || doc.status === "embedding",
          )
        : documents,
    [documents, filter],
  );

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Filter document library"
        className="inline-flex rounded-full border border-border bg-surface p-1"
      >
        {FILTERS.map((option) => {
          const isSelected = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setFilter(option.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isSelected
                  ? "bg-brand text-brand-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          containScroll && "sm:max-h-[28rem] sm:overflow-y-auto sm:overscroll-contain sm:pr-1 lg:max-h-[calc(100vh-14rem)]",
        )}
      >
        {loadError ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-danger/30 py-12 text-center text-danger">
            <AlertCircle aria-hidden="true" className="h-8 w-8" />
            <p className="text-sm">{loadError}</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading your documents&hellip;</p>
          </div>
        ) : visibleDocuments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground"
          >
            <FolderOpen aria-hidden="true" className="h-8 w-8" />
            <p className="text-sm">
              {filter === "processing"
                ? "Nothing is processing right now."
                : "No documents yet. Upload one to get started."}
            </p>
          </motion.div>
        ) : (
          <ul className="grid grid-cols-1 gap-4">
            <AnimatePresence initial={false}>
              {visibleDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  onRemove={() => setPendingDelete({ id: document.id, filename: document.filename })}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete document?"
        description={
          pendingDelete
            ? `"${pendingDelete.filename}" will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingDelete) onRemove(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
