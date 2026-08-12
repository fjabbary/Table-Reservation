import { SearchForm } from "@/components/SearchForm";
import { TableCard } from "@/components/TableCard";
import { EmptyState } from "@/components/EmptyState";
import { findAvailableTables, validateSearchInput } from "@/lib/availability";
import { formatDate, formatTime } from "@/lib/format";
import {
  hasSearchParams,
  parseSearchParams,
  type RawSearchParams,
} from "@/lib/search-params";

type SearchPageProps = {
  searchParams: Promise<RawSearchParams>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;

  // First visit, no search submitted yet.
  if (!hasSearchParams(raw)) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
        <SearchForm />
        <EmptyState
          title="Search for a table"
          message="Enter a date, time, and party size above to see which tables are available."
        />
      </main>
    );
  }

  const input = parseSearchParams(raw);
  const result = validateSearchInput(input);

  const formDefaults = {
    defaultDate: input.date || undefined,
    defaultTime: input.time || undefined,
    defaultPartySize: Number.isFinite(input.partySize)
      ? input.partySize
      : undefined,
    defaultLocation: input.location,
  };

  if (!result.valid) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
        <SearchForm {...formDefaults} />
        <EmptyState title="Let's try that again" message={result.error} />
      </main>
    );
  }

  const tables = await findAvailableTables(result.value);

  // console.log(tables);

  const queryString = new URLSearchParams({
    date: input.date,
    time: input.time,
    partySize: String(input.partySize),
    ...(input.location ? { location: input.location } : {}),
  }).toString();

  const availableTime = formatTime(result.value.start);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <SearchForm {...formDefaults} />

      <p className="text-sm text-muted">
        {tables.length} {tables.length === 1 ? "table" : "tables"} available for{" "}
        {result.value.partySize}{" "}
        {result.value.partySize === 1 ? "guest" : "guests"} on{" "}
        {formatDate(result.value.start)} at {availableTime}
      </p>

      {tables.length === 0 ? (
        <EmptyState
          title="No tables available"
          message="Try a different time, date, or party size — or check another location."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              searchQueryString={queryString}
              availableTime={availableTime}
            />
          ))}
        </div>
      )}
    </main>
  );
}
