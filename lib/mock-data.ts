export type DocumentType = "pdf" | "docx" | "txt" | "md" | "csv";
export type DocumentStatus = "processing" | "ready" | "error";

export type MockDocument = {
  id: string;
  name: string;
  type: DocumentType;
  sizeLabel: string;
  uploadedAt: string;
  status: DocumentStatus;
  progress: number;
};

export const initialMockDocuments: MockDocument[] = [
  {
    id: "doc-1",
    name: "Q3-financial-report.pdf",
    type: "pdf",
    sizeLabel: "2.4 MB",
    uploadedAt: "2 days ago",
    status: "ready",
    progress: 100,
  },
  {
    id: "doc-2",
    name: "product-requirements.docx",
    type: "docx",
    sizeLabel: "816 KB",
    uploadedAt: "5 days ago",
    status: "ready",
    progress: 100,
  },
  {
    id: "doc-3",
    name: "customer-interview-notes.md",
    type: "md",
    sizeLabel: "112 KB",
    uploadedAt: "1 week ago",
    status: "ready",
    progress: 100,
  },
  {
    id: "doc-4",
    name: "onboarding-dataset.csv",
    type: "csv",
    sizeLabel: "4.1 MB",
    uploadedAt: "Just now",
    status: "processing",
    progress: 62,
  },
  {
    id: "doc-5",
    name: "meeting-transcript.txt",
    type: "txt",
    sizeLabel: "58 KB",
    uploadedAt: "3 weeks ago",
    status: "ready",
    progress: 100,
  },
];

export type DemoExchange = {
  question: string;
  answer: string;
};

export const demoExchanges: DemoExchange[] = [
  {
    question: "What were the key findings in the Q3 report?",
    answer:
      "Revenue grew 18% quarter-over-quarter, driven mainly by expansion in enterprise accounts. Churn dropped to 3.2%, the lowest recorded this year.",
  },
  {
    question: "Summarize the onboarding dataset in two sentences.",
    answer:
      "Most users complete onboarding within 4 minutes, with the document-upload step causing the largest drop-off. Adding a progress indicator is the top-requested fix.",
  },
  {
    question: "What did customers say about the search experience?",
    answer:
      "Interview notes show customers want answers grounded in their own files, not generic responses. Voice input was called out as a time-saver during meetings.",
  },
];
