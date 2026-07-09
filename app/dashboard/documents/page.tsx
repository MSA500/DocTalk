import type { Metadata } from "next";
import { DocumentsPageContent } from "@/components/dashboard/DocumentsPageContent";

export const metadata: Metadata = {
  title: "All Documents",
  description: "Browse and manage every document uploaded in this DocTalk preview session.",
  alternates: {
    canonical: "/dashboard/documents",
  },
};

export default function DashboardDocumentsPage() {
  return <DocumentsPageContent />;
}
