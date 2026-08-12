import Link from "next/link";
import type { Table } from "@/generated/prisma/client";
import { LocationBadge } from "@/components/LocationBadge";

type TableCardProps = {
  table: Table;
  /** e.g. "date=2026-08-12&time=19%3A00&partySize=4" — forwarded to the detail page. */
  searchQueryString: string;
  /** Formatted requested time, e.g. "7:00 PM". */
  availableTime: string;
};

export function TableCard({ table, searchQueryString, availableTime }: TableCardProps) {
  return (
    <Link
      href={`/tables/${table.id}?${searchQueryString}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-card-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- local static placeholder, no optimization needed */}
        <img
          src={table.imageUrl ?? "/placeholder-table.svg"}
          alt=""
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{table.name}</h3>
          <LocationBadge location={table.location} />
        </div>
        <p className="text-sm text-muted">Seats up to {table.capacity}</p>
        <p className="mt-auto text-sm font-medium text-accent">Available at {availableTime}</p>
      </div>
    </Link>
  );
}
