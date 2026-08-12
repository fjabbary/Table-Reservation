"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In a real app this would go to an error-reporting service.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-sm font-medium text-muted">Something went wrong</p>
      <h1 className="text-2xl font-semibold">We hit a snag</h1>
      <p className="max-w-md text-muted">
        An unexpected error occurred while loading this page. You can try again, or head
        back home.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-card-border px-5 py-2.5 font-medium hover:bg-card-border"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
