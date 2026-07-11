import type { Metadata } from "next";
import { HistoryPageContent } from "@/components/dashboard/HistoryPageContent";

export const metadata: Metadata = {
  title: "Conversation History",
  description: "Browse every question you've asked DocTalk in this session.",
  alternates: {
    canonical: "/dashboard/history",
  },
};

export default function DashboardHistoryPage() {
  return <HistoryPageContent />;
}
