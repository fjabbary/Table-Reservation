import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isTableAvailable, validateSearchInput } from "@/lib/availability";
import { formatDate, formatTime } from "@/lib/format";
import { hasSearchParams, parseSearchParams, type RawSearchParams } from "@/lib/search-params";
import { SearchForm } from "@/components/SearchForm";
import { LocationBadge } from "@/components/LocationBadge";
import { createReservation } from "./actions";

type ReservePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
};

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-red-100 px-4 py-3 text-sm text-red-900 dark:bg-red-900/30 dark:text-red-200">
      {message}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function fieldInputClassName(hasError: boolean): string {
  const base = "rounded-lg border bg-background px-3 py-2 outline-none focus:border-accent";
  return hasError ? `${base} border-red-400 dark:border-red-500` : `${base} border-card-border`;
}

export default async function ReservePage({ params, searchParams }: ReservePageProps) {
  const { id } = await params;
  const raw = await searchParams;

  const table = await db.table.findUnique({ where: { id } });
  if (!table) notFound();

  const reserveAction = `/tables/${table.id}/reserve`;
  const errorParam = typeof raw.error === "string" ? raw.error : undefined;

  // No date/time/party size yet — collect it before showing guest fields.
  if (!hasSearchParams(raw)) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">Reserve {table.name}</h1>
        <p className="text-muted">Choose a date, time, and party size to continue.</p>
        <SearchForm action={reserveAction} showLocation={false} submitLabel="Check Availability" />
      </main>
    );
  }

  const input = parseSearchParams(raw);
  const result = validateSearchInput(input);

  const formDefaults = {
    defaultDate: input.date || undefined,
    defaultTime: input.time || undefined,
    defaultPartySize: Number.isFinite(input.partySize) ? input.partySize : undefined,
  };

  if (!result.valid) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">Reserve {table.name}</h1>
        <ErrorBanner message={result.error} />
        <SearchForm
          action={reserveAction}
          showLocation={false}
          submitLabel="Check Availability"
          {...formDefaults}
        />
      </main>
    );
  }

  if (table.capacity < result.value.partySize) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">Reserve {table.name}</h1>
        <ErrorBanner
          message={`This table seats up to ${table.capacity} guests, which is fewer than your party of ${result.value.partySize}.`}
        />
        <Link href={`/tables/${table.id}`} className="text-sm text-accent underline">
          ← Choose a different table
        </Link>
      </main>
    );
  }

  const stillAvailable = await isTableAvailable(table.id, result.value);
  if (!stillAvailable) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">Reserve {table.name}</h1>
        <ErrorBanner message="This table was just booked for that time by someone else." />
        <Link href="/search" className="text-sm text-accent underline">
          ← Search again
        </Link>
      </main>
    );
  }

  const queryString = new URLSearchParams({
    date: input.date,
    time: input.time,
    partySize: String(input.partySize),
    ...(input.location ? { location: input.location } : {}),
  }).toString();

  const guestDefaults = {
    guestName: typeof raw.guestName === "string" ? raw.guestName : "",
    guestEmail: typeof raw.guestEmail === "string" ? raw.guestEmail : "",
    guestPhone: typeof raw.guestPhone === "string" ? raw.guestPhone : "",
    specialRequests: typeof raw.specialRequests === "string" ? raw.specialRequests : "",
  };

  const fieldErrors = {
    guestName: typeof raw.guestNameError === "string" ? raw.guestNameError : undefined,
    guestEmail: typeof raw.guestEmailError === "string" ? raw.guestEmailError : undefined,
    guestPhone: typeof raw.guestPhoneError === "string" ? raw.guestPhoneError : undefined,
    specialRequests:
      typeof raw.specialRequestsError === "string" ? raw.specialRequestsError : undefined,
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <Link
        href={`/tables/${table.id}?${queryString}`}
        className="text-sm text-muted hover:text-accent"
      >
        ← Back to {table.name}
      </Link>

      <div className="rounded-2xl border border-card-border bg-card p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-card-border pb-6">
          <div>
            <h1 className="text-xl font-semibold">Reserve {table.name}</h1>
            <p className="text-sm text-muted">
              {result.value.partySize} {result.value.partySize === 1 ? "guest" : "guests"} ·{" "}
              {formatDate(result.value.start)} at {formatTime(result.value.start)}
            </p>
          </div>
          <LocationBadge location={table.location} />
        </div>

        {errorParam && (
          <div className="mb-6">
            <ErrorBanner message={errorParam} />
          </div>
        )}

        <form action={createReservation} noValidate className="flex flex-col gap-4">
          <input type="hidden" name="tableId" value={table.id} />
          <input type="hidden" name="date" value={input.date} />
          <input type="hidden" name="time" value={input.time} />
          <input type="hidden" name="partySize" value={input.partySize} />
          {input.location && <input type="hidden" name="location" value={input.location} />}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="guestName" className="text-sm font-medium text-muted">
              Full name
            </label>
            <input
              id="guestName"
              name="guestName"
              type="text"
              maxLength={100}
              defaultValue={guestDefaults.guestName}
              aria-invalid={Boolean(fieldErrors.guestName)}
              className={fieldInputClassName(Boolean(fieldErrors.guestName))}
            />
            <FieldError message={fieldErrors.guestName} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="guestEmail" className="text-sm font-medium text-muted">
                Email
              </label>
              <input
                id="guestEmail"
                name="guestEmail"
                type="email"
                maxLength={200}
                defaultValue={guestDefaults.guestEmail}
                aria-invalid={Boolean(fieldErrors.guestEmail)}
                className={fieldInputClassName(Boolean(fieldErrors.guestEmail))}
              />
              <FieldError message={fieldErrors.guestEmail} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="guestPhone" className="text-sm font-medium text-muted">
                Phone
              </label>
              <input
                id="guestPhone"
                name="guestPhone"
                type="tel"
                inputMode="numeric"
                placeholder="5551234567"
                maxLength={10}
                defaultValue={guestDefaults.guestPhone}
                aria-invalid={Boolean(fieldErrors.guestPhone)}
                className={fieldInputClassName(Boolean(fieldErrors.guestPhone))}
              />
              <FieldError message={fieldErrors.guestPhone} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="specialRequests" className="text-sm font-medium text-muted">
              Special requests <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="specialRequests"
              name="specialRequests"
              rows={3}
              maxLength={500}
              defaultValue={guestDefaults.specialRequests}
              placeholder="Dietary restrictions, celebrations, accessibility needs, etc."
              aria-invalid={Boolean(fieldErrors.specialRequests)}
              className={fieldInputClassName(Boolean(fieldErrors.specialRequests))}
            />
            <FieldError message={fieldErrors.specialRequests} />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90"
          >
            Confirm Reservation
          </button>
        </form>
      </div>
    </main>
  );
}
