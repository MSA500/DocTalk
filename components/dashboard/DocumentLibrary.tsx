"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import type { MockDocument } from "@/lib/mock-data";
import { DocumentCard } from "@/components/dashboard/DocumentCard";
import { cn } from "@/lib/utils";

type LibraryFilter = "all" | "processing";

const FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All documents" },
  { value: "processing", label: "In progress" },
];

type DocumentLibraryProps = {
  documents: MockDocument[];
  onRemove: (id: string) => void;
  containScroll?: boolean;
};

export function DocumentLibrary({ documents, onRemove, containScroll = false }: DocumentLibraryProps) {
  const [filter, setFilter] = useState<LibraryFilter>("all");

  const visibleDocuments = useMemo(
    () => (filter === "processing" ? documents.filter((doc) => doc.status === "processing") : documents),
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
        {visibleDocuments.length === 0 ? (
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
                <DocumentCard key={document.id} document={document} onRemove={onRemove} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
