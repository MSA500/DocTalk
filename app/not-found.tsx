import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Compass aria-hidden="true" className="h-8 w-8" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-3 text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Back to home
      </Link>
    </div>
  );
}
