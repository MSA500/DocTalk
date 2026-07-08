"use client";

import { useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadAreaProps = {
  onFilesSelected: (files: FileList) => void;
};

export function UploadArea({ onFilesSelected }: UploadAreaProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

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
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        isDragActive
          ? "border-brand bg-brand/5"
          : "border-border bg-surface",
      )}
    >
      <motion.div
        animate={isDragActive ? { y: [-2, 2, -2] } : { y: 0 }}
        transition={{ duration: 1.2, repeat: isDragActive ? Infinity : 0, ease: "easeInOut" }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand"
      >
        <UploadCloud aria-hidden="true" className="h-7 w-7" />
      </motion.div>

      <div>
        <p className="font-medium text-foreground">
          Drag &amp; drop files here
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          or browse from your device &mdash; PDF, DOCX, TXT, MD, CSV
        </p>
      </div>

      <label htmlFor={inputId} className="sr-only">
        Upload documents
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            onFilesSelected(event.target.files);
            event.target.value = "";
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-1 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Browse files
      </button>
    </div>
  );
}
