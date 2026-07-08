"use client";

import { motion } from "framer-motion";
import { FileCode2, FileSpreadsheet, FileText, X } from "lucide-react";
import type { MockDocument } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<MockDocument["type"], typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  md: FileCode2,
  csv: FileSpreadsheet,
};

const STATUS_STYLE: Record<MockDocument["status"], string> = {
  ready: "bg-accent/10 text-accent",
  processing: "bg-brand/10 text-brand",
  error: "bg-danger/10 text-danger",
};

const STATUS_LABEL: Record<MockDocument["status"], string> = {
  ready: "Ready",
  processing: "Processing",
  error: "Error",
};

type DocumentCardProps = {
  document: MockDocument;
  onRemove: (id: string) => void;
};

export function DocumentCard({ document, onRemove }: DocumentCardProps) {
  const Icon = TYPE_ICON[document.type];

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <button
        type="button"
        onClick={() => onRemove(document.id)}
        aria-label={`Remove ${document.name}`}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface-alt hover:text-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover:opacity-100"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {document.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {document.sizeLabel} &middot; {document.uploadedAt}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLE[document.status],
          )}
        >
          {STATUS_LABEL[document.status]}
        </span>
        {document.status === "processing" && (
          <span className="text-xs text-muted-foreground">
            {document.progress}%
          </span>
        )}
      </div>

      {document.status === "processing" && (
        <div
          role="progressbar"
          aria-label={`${document.name} processing progress`}
          aria-valuenow={document.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt"
        >
          <motion.div
            className="h-full rounded-full bg-brand"
            animate={{ width: `${document.progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      )}
    </motion.li>
  );
}
