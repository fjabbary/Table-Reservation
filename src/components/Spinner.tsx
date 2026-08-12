export function Spinner() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-card-border border-t-accent"
        role="status"
        aria-label="Loading"
      />
      <p className="text-sm text-muted">Loading…</p>
    </div>
  );
}
