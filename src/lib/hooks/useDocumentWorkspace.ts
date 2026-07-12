"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { getDocumentType, formatFileSize } from "@/lib/document-type";
import { MAX_FILE_SIZE_BYTES } from "@/lib/documents/validate-upload";
import type { DocumentRecord } from "@/lib/types/document";

export type DisplayDocument = DocumentRecord & {
  uploadProgress?: number;
};

type PendingUpload = {
  id: string;
  filename: string;
  sizeBytes: number;
  uploadProgress: number;
};

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 80; // ~2 minutes

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

function isTerminal(status: DocumentRecord["status"]): boolean {
  return status === "ready" || status === "failed";
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
  const pollIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const intervals = pollIntervalsRef.current;
    return () => {
      isMountedRef.current = false;
      intervals.forEach((interval) => clearInterval(interval));
      intervals.clear();
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
        setDocuments(body.documents ?? []);
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
  }, []);

  function updateDocument(document: DocumentRecord) {
    if (!isMountedRef.current) return;
    setDocuments((docs) => {
      const exists = docs.some((doc) => doc.id === document.id);
      return exists ? docs.map((doc) => (doc.id === document.id ? document : doc)) : [document, ...docs];
    });
  }

  function stopPolling(id: string) {
    const interval = pollIntervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      pollIntervalsRef.current.delete(id);
    }
  }

  function startPolling(id: string) {
    stopPolling(id);
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        stopPolling(id);
        return;
      }

      try {
        const response = await fetch(`/api/documents/${id}`);
        if (!response.ok) return;
        const body = await response.json();
        if (!body?.document) return;

        updateDocument(body.document);
        if (isTerminal(body.document.status)) {
          stopPolling(id);
        }
      } catch {
        // Let the next tick (or /process's own response) resolve things.
      }
    }, POLL_INTERVAL_MS);

    pollIntervalsRef.current.set(id, interval);
  }

  async function runProcessing(document: DocumentRecord) {
    startPolling(document.id);

    try {
      const response = await fetch(`/api/documents/${document.id}/process`, { method: "POST" });
      const body = await response.json();
      stopPolling(document.id);

      if (response.ok && body?.document) {
        updateDocument(body.document);
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
      } else {
        showToast({
          variant: "error",
          title: "Processing failed",
          description: body?.error?.message || "Something went wrong while processing this document.",
        });
      }
    } catch {
      stopPolling(document.id);
      // The row may have reached a terminal state server-side even though
      // this request dropped — check once more before giving up.
      try {
        const response = await fetch(`/api/documents/${document.id}`);
        const body = await response.json();
        if (body?.document) updateDocument(body.document);
      } catch {}
      showToast({
        variant: "error",
        title: "Processing interrupted",
        description: "A network error interrupted processing. It may still complete — check back shortly.",
      });
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
          runProcessing(document);
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

    stopPolling(id);
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
    ...documents,
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
