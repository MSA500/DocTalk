"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

type CompactUploadBarProps = {
  onFilesSelected: (files: FileList) => void;
  onBrowseClick: () => void;
  className?: string;
};

export function CompactUploadBar({ onFilesSelected, onBrowseClick, className }: CompactUploadBarProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={() => setIsDragActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        if (event.dataTransfer.files.length > 0) {
          onFilesSelected(event.dataTransfer.files);
        }
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4 transition-colors sm:flex-row sm:justify-between",
        isDragActive ? "border-brand bg-brand/5" : "border-border bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-3 text-center sm:text-left">
        <motion.div
          animate={isDragActive ? { y: [-2, 2, -2] } : { y: 0 }}
          transition={{ duration: 1.2, repeat: isDragActive ? Infinity : 0, ease: "easeInOut" }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"
        >
          <UploadCloud aria-hidden="true" className="h-4.5 w-4.5" />
        </motion.div>
        <div>
          <p className="text-sm font-medium text-foreground">Upload documents</p>
          <p className="text-xs text-muted-foreground">
            Drag &amp; drop or browse &mdash; PDF, DOCX, or TXT, up to 15 MB
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onBrowseClick}
        className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Browse files
      </button>
    </div>
  );
}
