import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted">
        We couldn&apos;t find what you were looking for — it may have been moved, or the
        link might be out of date.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90"
      >
        Back to Home
      </Link>
    </main>
  );
}
