"use client";

import { useEffect, useRef, useState } from "react";
import { UploadArea } from "@/components/dashboard/UploadArea";
import { DocumentLibrary } from "@/components/dashboard/DocumentLibrary";
import { initialMockDocuments, type MockDocument } from "@/lib/mock-data";
import { formatFileSize, getDocumentType } from "@/lib/document-type";

let nextId = initialMockDocuments.length + 1;

export function DocumentWorkspace() {
  const [documents, setDocuments] = useState<MockDocument[]>(initialMockDocuments);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    const intervals = intervalsRef.current;
    return () => {
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, []);

  function simulateProgress(id: string) {
    const interval = setInterval(() => {
      setDocuments((docs) =>
        docs.map((doc) => {
          if (doc.id !== id || doc.status !== "processing") return doc;
          const nextProgress = Math.min(100, doc.progress + Math.round(8 + Math.random() * 14));
          if (nextProgress >= 100) {
            clearInterval(interval);
            intervalsRef.current.delete(id);
            return { ...doc, progress: 100, status: "ready" };
          }
          return { ...doc, progress: nextProgress };
        }),
      );
    }, 450);
    intervalsRef.current.set(id, interval);
  }

  function handleFilesSelected(files: FileList) {
    const newDocs: MockDocument[] = Array.from(files).map((file) => ({
      id: `doc-upload-${nextId++}`,
      name: file.name,
      type: getDocumentType(file.name),
      sizeLabel: formatFileSize(file.size),
      uploadedAt: "Just now",
      status: "processing",
      progress: 4,
    }));

    setDocuments((docs) => [...newDocs, ...docs]);
    newDocs.forEach((doc) => simulateProgress(doc.id));
  }

  function handleRemove(id: string) {
    const interval = intervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      intervalsRef.current.delete(id);
    }
    setDocuments((docs) => docs.filter((doc) => doc.id !== id));
  }

  return (
    <div className="space-y-6">
      <UploadArea onFilesSelected={handleFilesSelected} />
      <DocumentLibrary documents={documents} onRemove={handleRemove} />
    </div>
  );
}
