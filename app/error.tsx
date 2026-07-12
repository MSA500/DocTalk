"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle aria-hidden="true" className="h-8 w-8" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-3 text-muted-foreground">
        An unexpected error occurred. Try again, or head back to the dashboard.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
