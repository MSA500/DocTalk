"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { getDocumentType, formatFileSize } from "@/lib/document-type";
import { MAX_FILE_SIZE_BYTES } from "@/lib/documents/validate-upload";
import type { DocumentRecord, ProcessingProgress } from "@/lib/types/document";

export type DisplayDocument = DocumentRecord & {
  uploadProgress?: number;
  embeddingProgress?: ProcessingProgress;
};

type PendingUpload = {
  id: string;
  filename: string;
  sizeBytes: number;
  uploadProgress: number;
};

// Each /process call does one bounded step (extract, or one embed slice). The
// client keeps calling until `done`. These bound the loop so a persistently
// failing embedder can't spin forever — the document is just left resumable.
const MAX_PROCESS_CALLS = 200;
const MAX_STALLS = 10;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateClientSide(file: File): string | null {
  if (!getDocumentType(file.name)) {
    return "Unsupported file type. DocTalk accepts PDF, DOCX, and TXT files only.";
  }
  if (file.size === 0) {
    return "This file is empty.";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File is too large (${formatFileSize(file.size)}). The maximum is ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`;
  }
  return null;
}

function randomId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isInProgress(status: DocumentRecord["status"]): boolean {
  return status === "uploading" || status === "extracting" || status === "embedding";
}

// Module-scoped, not React state, so it survives template.tsx remounting
// this hook's component on every navigation — repeat visits to Dashboard/
// Documents render last-known documents immediately instead of a fresh
// loading flash, while the effect below still revalidates in the background.
let documentsCache: DocumentRecord[] | null = null;

export function useDocumentWorkspace() {
  const { showToast } = useToast();
  const [documents, setDocumentsState] = useState<DocumentRecord[]>(() => documentsCache ?? []);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [embeddingProgress, setEmbeddingProgress] = useState<Record<string, ProcessingProgress>>({});
  const [isLoading, setIsLoading] = useState(() => documentsCache === null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function setDocuments(updater: DocumentRecord[] | ((prev: DocumentRecord[]) => DocumentRecord[])) {
    setDocumentsState((prev) => {
      const next = typeof updater === "function" ? (updater as (prev: DocumentRecord[]) => DocumentRecord[])(prev) : updater;
      documentsCache = next;
      return next;
    });
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef<Map<string, XMLHttpRequest>>(new Map());
  const activeProcessingRef = useRef<Set<string>>(new Set());
  const cancelledProcessingRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      try {
        const response = await fetch("/api/documents");
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(body?.error?.message || "Couldn't load your documents.");
        }
        const loaded: DocumentRecord[] = body.documents ?? [];
        setDocuments(loaded);
        if (body.progress) setEmbeddingProgress(body.progress as Record<string, ProcessingProgress>);

        // Resume any document left mid-pipeline (e.g. a large upload whose tab
        // was closed, or one interrupted by a deploy). Each is idempotent and
        // guarded against a duplicate loop.
        for (const doc of loaded) {
          if (isInProgress(doc.status)) runProcessing(doc.id);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadDocuments();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateDocument(document: DocumentRecord, progress?: ProcessingProgress) {
    if (!isMountedRef.current) return;
    setDocuments((docs) => {
      const exists = docs.some((doc) => doc.id === document.id);
      return exists ? docs.map((doc) => (doc.id === document.id ? document : doc)) : [document, ...docs];
    });
    setEmbeddingProgress((prev) => {
      if (progress && document.status === "embedding") {
        return { ...prev, [document.id]: progress };
      }
      if (!prev[document.id]) return prev;
      const next = { ...prev };
      delete next[document.id];
      return next;
    });
  }

  function clearProgress(id: string) {
    setEmbeddingProgress((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  // Drives the document through the pipeline one bounded step at a time until
  // it reaches a terminal state, this client stops (unmount/remove), or the
  // loop gives up — in which case the document stays resumable on next load.
  async function runProcessing(documentId: string) {
    if (activeProcessingRef.current.has(documentId)) return;
    activeProcessingRef.current.add(documentId);
    cancelledProcessingRef.current.delete(documentId);

    let stalls = 0;
    let lastEmbedded = -1;

    try {
      for (let calls = 0; calls < MAX_PROCESS_CALLS; calls++) {
        if (cancelledProcessingRef.current.has(documentId) || !isMountedRef.current) return;

        let response: Response;
        let body: {
          document?: DocumentRecord;
          progress?: ProcessingProgress;
          done?: boolean;
          retryable?: boolean;
          error?: { message: string };
        };
        try {
          response = await fetch(`/api/documents/${documentId}/process`, { method: "POST" });
          body = await response.json();
        } catch {
          stalls += 1;
          if (stalls > MAX_STALLS) break;
          await delay(2000);
          continue;
        }

        if (cancelledProcessingRef.current.has(documentId) || !isMountedRef.current) return;

        if (response.status === 429) {
          stalls += 1;
          if (stalls > MAX_STALLS) break;
          await delay(4000);
          continue;
        }

        if (!response.ok || body.error || !body.document) {
          stalls += 1;
          if (stalls > MAX_STALLS) break;
          await delay(2000);
          continue;
        }

        updateDocument(body.document, body.progress);

        if (body.done) {
          if (body.document.status === "ready") {
            showToast({
              variant: "success",
              title: "Document ready",
              description: `${body.document.filename} was processed and is ready to use.`,
            });
          } else if (body.document.status === "failed") {
            showToast({
              variant: "error",
              title: "Processing failed",
              description: body.document.errorMessage || `${body.document.filename} could not be processed.`,
            });
          }
          return;
        }

        const embedded = body.progress?.embedded ?? lastEmbedded;
        if (embedded > lastEmbedded) {
          lastEmbedded = embedded;
          stalls = 0;
        } else {
          stalls += 1;
          if (stalls > MAX_STALLS) break;
        }

        await delay(body.retryable ? 2500 * Math.min(stalls + 1, 4) : 350);
      }

      // Loop cap or stall limit hit without finishing — leave it resumable.
      if (!cancelledProcessingRef.current.has(documentId) && isMountedRef.current) {
        showToast({
          variant: "error",
          title: "Still processing",
          description:
            "This large document is taking a while. Its progress is saved — reload the page and it will pick up where it left off.",
        });
      }
    } finally {
      activeProcessingRef.current.delete(documentId);
    }
  }

  function uploadOne(file: File) {
    const validationMessage = validateClientSide(file);
    if (validationMessage) {
      showToast({ variant: "error", title: "Couldn't upload this file", description: validationMessage });
      return;
    }

    const tempId = randomId();
    setPendingUploads((prev) => [...prev, { id: tempId, filename: file.name, sizeBytes: file.size, uploadProgress: 0 }]);

    const xhr = new XMLHttpRequest();
    activeUploadsRef.current.set(tempId, xhr);
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      setPendingUploads((prev) =>
        prev.map((upload) => (upload.id === tempId ? { ...upload, uploadProgress: progress } : upload)),
      );
    });

    xhr.addEventListener("load", () => {
      activeUploadsRef.current.delete(tempId);
      setPendingUploads((prev) => prev.filter((upload) => upload.id !== tempId));

      let body: { document?: DocumentRecord; error?: { message: string } } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && body?.document) {
        const document = body.document;
        updateDocument(document);
        if (document.status === "failed") {
          showToast({
            variant: "error",
            title: "Upload failed",
            description: document.errorMessage || `${document.filename} could not be uploaded.`,
          });
        } else {
          runProcessing(document.id);
        }
      } else {
        showToast({
          variant: "error",
          title: "Upload failed",
          description: body?.error?.message || "Something went wrong while uploading.",
        });
      }
    });

    xhr.addEventListener("error", () => {
      activeUploadsRef.current.delete(tempId);
      setPendingUploads((prev) => prev.filter((upload) => upload.id !== tempId));
      showToast({ variant: "error", title: "Upload failed", description: "A network error interrupted the upload." });
    });

    xhr.open("POST", "/api/documents/upload");
    xhr.send(formData);
  }

  function handleFilesSelected(files: FileList) {
    Array.from(files).forEach(uploadOne);
  }

  async function handleRemove(id: string) {
    const activeUpload = activeUploadsRef.current.get(id);
    if (activeUpload) {
      activeUpload.abort();
      activeUploadsRef.current.delete(id);
      setPendingUploads((prev) => prev.filter((upload) => upload.id !== id));
      return;
    }

    cancelledProcessingRef.current.add(id);
    clearProgress(id);
    const previousDocuments = documents;
    setDocuments((docs) => docs.filter((doc) => doc.id !== id));

    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || "Couldn't remove this document.");
      }
    } catch (err) {
      setDocuments(previousDocuments);
      showToast({ variant: "error", title: "Couldn't remove document", description: (err as Error).message });
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      handleFilesSelected(event.target.files);
      event.target.value = "";
    }
  }

  const displayDocuments: DisplayDocument[] = [
    ...pendingUploads.map((upload) => ({
      id: upload.id,
      filename: upload.filename,
      fileType: getDocumentType(upload.filename) ?? "txt",
      sizeBytes: upload.sizeBytes,
      status: "uploading" as const,
      errorMessage: null,
      chunkCount: 0,
      createdAt: new Date().toISOString(),
      uploadProgress: upload.uploadProgress,
    })),
    ...documents.map((doc) => ({ ...doc, embeddingProgress: embeddingProgress[doc.id] })),
  ];

  return {
    documents: displayDocuments,
    isLoading,
    loadError,
    handleFilesSelected,
    handleRemove,
    fileInputRef,
    openFilePicker,
    handleInputChange,
  };
}
