import Link from "next/link";

type EmptyStateProps = {
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ title, message, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-card-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-muted">{message}</p>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
