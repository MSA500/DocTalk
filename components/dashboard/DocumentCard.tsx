"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileText, ScanText, Sparkles, UploadCloud, X } from "lucide-react";
import type { DisplayDocument } from "@/lib/hooks/useDocumentWorkspace";
import { formatFileSize } from "@/lib/document-type";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/types/document";

const STAGES: { key: DocumentStatus; label: string; icon: typeof UploadCloud }[] = [
  { key: "uploading", label: "Uploading", icon: UploadCloud },
  { key: "extracting", label: "Extracting text", icon: ScanText },
  { key: "embedding", label: "Generating embeddings", icon: Sparkles },
  { key: "ready", label: "Ready", icon: CheckCircle2 },
];

const STATUS_STYLE: Record<DisplayDocument["status"], string> = {
  uploading: "bg-brand/10 text-brand",
  extracting: "bg-brand/10 text-brand",
  embedding: "bg-brand/10 text-brand",
  ready: "bg-accent/10 text-accent",
  failed: "bg-danger/10 text-danger",
};

const STATUS_LABEL: Record<DisplayDocument["status"], string> = {
  uploading: "Uploading",
  extracting: "Extracting text",
  embedding: "Generating embeddings",
  ready: "Ready",
  failed: "Failed",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type DocumentCardProps = {
  document: DisplayDocument;
  onRemove: (id: string) => void;
};

export function DocumentCard({ document, onRemove }: DocumentCardProps) {
  const isFailed = document.status === "failed";
  const isReady = document.status === "ready";
  const isInProgress = !isFailed && !isReady;
  const showDeterminateProgress = document.status === "uploading" && typeof document.uploadProgress === "number";
  const stageIndex = STAGES.findIndex((stage) => stage.key === document.status);

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
        aria-label={`Remove ${document.filename}`}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface-alt hover:text-danger focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover:opacity-100"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <FileText aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {document.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(document.sizeBytes)} &middot; {relativeTime(document.createdAt)}
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
        {showDeterminateProgress && (
          <span className="text-xs text-muted-foreground">{document.uploadProgress}%</span>
        )}
      </div>

      {isFailed && (
        <div className="flex items-start gap-1.5 text-xs text-danger">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{document.errorMessage || "This document could not be processed."}</span>
        </div>
      )}

      {isInProgress && (
        <div
          role="group"
          aria-label={`${document.filename} processing stage: ${STATUS_LABEL[document.status]}`}
          className="flex items-center"
        >
          {STAGES.map((stage, i) => {
            const isDone = i < stageIndex;
            const isActive = i === stageIndex;
            const Icon = stage.icon;
            return (
              <div key={stage.key} className="flex flex-1 items-center last:flex-none">
                <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                  {isActive && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-brand/30"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                  <div
                    className={cn(
                      "relative flex h-5 w-5 items-center justify-center rounded-full",
                      isDone && "bg-brand text-brand-foreground",
                      isActive && "bg-brand text-brand-foreground",
                      !isDone && !isActive && "bg-surface-alt text-muted-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-3 w-3" />
                  </div>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={cn("h-0.5 flex-1", isDone ? "bg-brand" : "bg-surface-alt")} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {showDeterminateProgress && (
        <div
          role="progressbar"
          aria-label={`${document.filename} upload progress`}
          aria-valuenow={document.uploadProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt"
        >
          <motion.div
            className="h-full rounded-full bg-brand"
            animate={{ width: `${document.uploadProgress}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      )}
    </motion.li>
  );
}
