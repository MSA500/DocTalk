import type { Metadata } from "next";
import { DocumentsPageContent } from "@/components/dashboard/DocumentsPageContent";

export const metadata: Metadata = {
  title: "All Documents",
  description: "Browse and manage every document you've uploaded to DocTalk.",
  alternates: {
    canonical: "/dashboard/documents",
  },
};

export default function DashboardDocumentsPage() {
  return <DocumentsPageContent />;
}
