import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-card-border bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Amber Table
        </Link>
        <span className="text-sm text-muted">Table Reservations</span>
      </div>
    </header>
  );
}
