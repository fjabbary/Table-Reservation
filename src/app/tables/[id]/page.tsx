import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isTableAvailable, validateSearchInput } from "@/lib/availability";
import { formatDate, formatTime, parseFeatures } from "@/lib/format";
import {
  hasSearchParams,
  parseSearchParams,
  type RawSearchParams,
} from "@/lib/search-params";
import { LocationBadge } from "@/components/LocationBadge";

type TableDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
};

export default async function TableDetailPage({
  params,
  searchParams,
}: TableDetailPageProps) {
  const { id } = await params;
  const raw = await searchParams;

  console.log("raw", raw);

  const table = await db.table.findUnique({ where: { id } });
  if (!table) notFound();

  const features = parseFeatures(table.features);

  console.log("features", features);

  // If the guest arrived from a search, carry that context forward (both to
  // show it back to them, and to forward it to the reservation form) and
  // double-check the table hasn't just been booked out from under them.
  let searchContext: {
    start: Date;
    partySize: number;
    queryString: string;
    stillAvailable: boolean;
  } | null = null;

  if (hasSearchParams(raw)) {
    const input = parseSearchParams(raw);
    const result = validateSearchInput(input);
    if (result.valid) {
      const queryString = new URLSearchParams({
        date: input.date,
        time: input.time,
        partySize: String(input.partySize),
        ...(input.location ? { location: input.location } : {}),
      }).toString();
      const stillAvailable = await isTableAvailable(table.id, result.value);
      searchContext = {
        start: result.value.start,
        partySize: result.value.partySize,
        queryString,
        stillAvailable,
      };
    }
  }

  const canReserve = !searchContext || searchContext.stillAvailable;

  console.log("searchContext", searchContext);

  const reserveHref = searchContext
    ? `/tables/${table.id}/reserve?${searchContext.queryString}`
    : `/tables/${table.id}/reserve`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      {searchContext && (
        <Link
          href={`/search?${searchContext.queryString}`}
          className="text-sm text-muted hover:text-accent"
        >
          ← Back to search results
        </Link>
      )}

      <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
        <div className="aspect-video w-full overflow-hidden bg-card-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- external/static placeholder, no optimization needed */}
          <img
            src={table.imageUrl ?? "/placeholder-table.svg"}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{table.name}</h1>
              <p className="text-muted">Seats up to {table.capacity}</p>
            </div>
            <LocationBadge location={table.location} />
          </div>

          {table.description && <p>{table.description}</p>}

          {features.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">
                Special Features
              </h2>
              <ul className="flex flex-wrap gap-2">
                {features.map((feature) => (
                  <li
                    key={feature}
                    className="rounded-full border border-card-border px-3 py-1 text-sm"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {table.policies && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">
                Reservation Policy
              </h2>
              <p className="text-sm text-muted">{table.policies}</p>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-card-border pt-6">
            {searchContext && !searchContext.stillAvailable && (
              <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-900 dark:bg-red-900/30 dark:text-red-200">
                This table was just booked for that time by someone else. Please
                try a different time or table.
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {searchContext ? (
                <p className="text-sm">
                  Reserving for{" "}
                  <span className="font-medium">{searchContext.partySize}</span>{" "}
                  {searchContext.partySize === 1 ? "guest" : "guests"} on{" "}
                  <span className="font-medium">
                    {formatDate(searchContext.start)}
                  </span>{" "}
                  at{" "}
                  <span className="font-medium">
                    {formatTime(searchContext.start)}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted">
                  <Link href="/" className="underline hover:text-accent">
                    Search for a date &amp; time
                  </Link>{" "}
                  to check this table&apos;s availability first.
                </p>
              )}

              {canReserve ? (
                <Link
                  href={reserveHref}
                  className="shrink-0 rounded-lg bg-accent px-6 py-2.5 text-center font-medium text-accent-foreground hover:opacity-90"
                >
                  Reserve Table
                </Link>
              ) : (
                <Link
                  href="/"
                  className="shrink-0 rounded-lg border border-card-border px-6 py-2.5 text-center font-medium hover:bg-card-border"
                >
                  Search again
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
