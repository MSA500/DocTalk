"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import type { MockDocument } from "@/lib/mock-data";
import { DocumentCard } from "@/components/dashboard/DocumentCard";

type DocumentLibraryProps = {
  documents: MockDocument[];
  onRemove: (id: string) => void;
};

export function DocumentLibrary({ documents, onRemove }: DocumentLibraryProps) {
  if (documents.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center text-muted-foreground"
      >
        <FolderOpen aria-hidden="true" className="h-8 w-8" />
        <p className="text-sm">No documents yet. Upload one to get started.</p>
      </motion.div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <AnimatePresence initial={false}>
        {documents.map((document) => (
          <DocumentCard key={document.id} document={document} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
