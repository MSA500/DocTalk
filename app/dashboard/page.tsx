import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Upload documents, browse your library, and preview the DocTalk voice assistant.",
  alternates: {
    canonical: "/dashboard",
  },
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          This is a static preview of the {siteConfig.name} dashboard. Upload
          and document processing shown here are simulated for Phase 1.
        </p>
      </div>

      <DashboardContent />
    </div>
  );
}
