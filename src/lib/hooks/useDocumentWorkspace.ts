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
// How long a document can sit at "uploading" before the resume scan gives up
// on it. Generous relative to even a slow 15MB upload, so a real in-flight
// transfer (possibly in a different tab/mount than the one doing the scan)
// isn't mistaken for an abandoned one.
const STUCK_UPLOAD_GRACE_MS = 3 * 60 * 1000;

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

// Only extracting/embedding can be resumed by calling /process again — it
// downloads the (already-confirmed-present) file from Storage and continues
// from there. A document still "uploading" has no confirmed file to resume
// from (the browser tab that held the File object is gone), so it's handled
// separately: cleanly failed rather than retried against a file that may
// never arrive.
function isResumableByProcessing(status: DocumentRecord["status"]): boolean {
  return status === "extracting" || status === "embedding";
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
  const [uploadProgressById, setUploadProgressById] = useState<Record<string, number>>({});
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
  // Keyed by tempId while prepare-upload is in flight, then by the real
  // document id once it exists — either way, one abort() cancels whichever
  // request is currently moving this upload forward.
  const activeUploadsRef = useRef<Map<string, { abort: () => void }>>(new Map());
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
          if (isResumableByProcessing(doc.status)) {
            runProcessing(doc.id);
          } else if (doc.status === "uploading" && Date.now() - Date.parse(doc.createdAt) > STUCK_UPLOAD_GRACE_MS) {
            // No confirmed file to resume from (see isResumableByProcessing).
            // The grace period avoids misfiring on a genuinely in-flight
            // upload from this same browser tab — template.tsx remounts this
            // hook on every navigation, so a fresh mount can otherwise race a
            // real upload that's still transferring.
            void confirmUpload(doc.id, false, "The upload was interrupted. Please try uploading this file again.");
          }
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
    if (document.status !== "uploading") setUploadProgress(document.id, undefined);
  }

  function clearProgress(id: string) {
    setEmbeddingProgress((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setUploadProgress(id, undefined);
  }

  function setUploadProgress(id: string, percent: number | undefined) {
    setUploadProgressById((prev) => {
      if (percent === undefined) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: percent };
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

  async function confirmUpload(documentId: string, success: boolean, errorMessage?: string) {
    try {
      const response = await fetch(`/api/documents/${documentId}/confirm-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success, errorMessage }),
      });
      const body = await response.json();
      if (body?.document) updateDocument(body.document as DocumentRecord);
      return body?.document as DocumentRecord | undefined;
    } catch {
      return undefined;
    }
  }

  // The file is PUT directly to Supabase Storage from the browser — never
  // through our own API — so its size is never limited by Vercel's
  // serverless request body cap. This mirrors supabase-js's own
  // uploadToSignedUrl() request shape (same headers/body/default
  // cacheControl) by hand, purely so xhr.upload progress events are
  // available for the progress bar, which the SDK helper doesn't expose.
  function putFileToSignedUrl(documentId: string, file: File, signedUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!anonKey) {
        reject(new Error("Uploads aren't configured on this deployment (missing Supabase public key)."));
        return;
      }

      const xhr = new XMLHttpRequest();
      activeUploadsRef.current.set(documentId, { abort: () => xhr.abort() });
      setUploadProgress(documentId, 0);

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        setUploadProgress(documentId, Math.round((event.loaded / event.total) * 100));
      });

      xhr.addEventListener("load", () => {
        activeUploadsRef.current.delete(documentId);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Storage upload failed (${xhr.status}).`));
        }
      });

      xhr.addEventListener("error", () => {
        activeUploadsRef.current.delete(documentId);
        reject(new Error("A network error interrupted the upload."));
      });

      xhr.addEventListener("abort", () => {
        activeUploadsRef.current.delete(documentId);
        reject(new DOMException("Upload cancelled.", "AbortError"));
      });

      const formData = new FormData();
      formData.append("cacheControl", "3600");
      formData.append("", file);

      xhr.open("PUT", signedUrl);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("Authorization", `Bearer ${anonKey}`);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.send(formData);
    });
  }

  async function uploadOne(file: File) {
    const validationMessage = validateClientSide(file);
    if (validationMessage) {
      showToast({ variant: "error", title: "Couldn't upload this file", description: validationMessage });
      return;
    }

    const tempId = randomId();
    setPendingUploads((prev) => [...prev, { id: tempId, filename: file.name, sizeBytes: file.size, uploadProgress: 0 }]);

    const controller = new AbortController();
    activeUploadsRef.current.set(tempId, { abort: () => controller.abort() });

    let document: DocumentRecord;
    let signedUrl: string | undefined;
    try {
      const response = await fetch("/api/documents/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, sizeBytes: file.size, mimeType: file.type }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok || body?.error) {
        throw new Error(body?.error?.message || "Something went wrong while starting the upload.");
      }
      document = body.document as DocumentRecord;
      signedUrl = body.signedUrl as string | undefined;
    } catch (err) {
      activeUploadsRef.current.delete(tempId);
      setPendingUploads((prev) => prev.filter((upload) => upload.id !== tempId));
      if ((err as Error).name === "AbortError") return;
      showToast({ variant: "error", title: "Upload failed", description: (err as Error).message });
      return;
    }

    activeUploadsRef.current.delete(tempId);
    setPendingUploads((prev) => prev.filter((upload) => upload.id !== tempId));
    updateDocument(document);

    if (document.status === "failed" || !signedUrl) {
      showToast({
        variant: "error",
        title: "Upload failed",
        description: document.errorMessage || `${document.filename} could not be uploaded.`,
      });
      return;
    }

    try {
      await putFileToSignedUrl(document.id, file, signedUrl);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await confirmUpload(document.id, false, (err as Error).message);
        showToast({ variant: "error", title: "Upload failed", description: (err as Error).message });
      }
      return;
    }

    const confirmed = await confirmUpload(document.id, true);
    if (!confirmed) {
      showToast({
        variant: "error",
        title: "Upload failed",
        description: "The file uploaded, but couldn't be confirmed. Please try again.",
      });
      return;
    }

    if (confirmed.status === "failed") {
      showToast({
        variant: "error",
        title: "Upload failed",
        description: confirmed.errorMessage || `${confirmed.filename} could not be uploaded.`,
      });
      return;
    }

    runProcessing(confirmed.id);
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
      clearProgress(id);
      // If prepare-upload had already created a real document row (id is no
      // longer just a tempId), remove it too, so a cancel mid-upload doesn't
      // leave a stuck "uploading" row. A DELETE for a tempId 404s harmlessly.
      setDocuments((docs) => docs.filter((doc) => doc.id !== id));
      void fetch(`/api/documents/${id}`, { method: "DELETE" }).catch(() => {});
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
    ...documents.map((doc) => ({
      ...doc,
      embeddingProgress: embeddingProgress[doc.id],
      uploadProgress: uploadProgressById[doc.id],
    })),
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
