"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";
import "@/styles/globals.css";

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center antialiased">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertOctagon aria-hidden="true" className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground">
          DocTalk hit a snag
        </h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Something went wrong loading the app. Try again, or reload the page.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
