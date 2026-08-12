import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/format";
import { LocationBadge } from "@/components/LocationBadge";

type ConfirmationPageProps = {
  params: Promise<{ reference: string }>;
};

export default async function ConfirmationPage({ params }: ConfirmationPageProps) {
  const { reference } = await params;

  const reservation = await db.reservation.findUnique({
    where: { referenceNumber: reference },
    include: { table: true },
  });

  if (!reservation) notFound();

  const { table } = reservation;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold">Reservation Confirmed</h1>
        <p className="text-muted">We&apos;ve saved the details below — see you soon.</p>
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-1 border-b border-card-border pb-6 text-center">
          <p className="text-sm text-muted">Reference Number</p>
          <p className="text-2xl font-semibold tracking-wide text-accent">
            {reservation.referenceNumber}
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted">Date &amp; Time</dt>
            <dd className="mt-1">
              {formatDate(reservation.startTime)} at {formatTime(reservation.startTime)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Party Size</dt>
            <dd className="mt-1">
              {reservation.partySize} {reservation.partySize === 1 ? "guest" : "guests"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Table</dt>
            <dd className="mt-1 flex items-center gap-2">
              {table.name} <LocationBadge location={table.location} />
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">Seating Capacity</dt>
            <dd className="mt-1">Up to {table.capacity} guests</dd>
          </div>
        </dl>

        <div className="mt-6 border-t border-card-border pt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">Guest Information</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted">Name</dt>
              <dd>{reservation.guestName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Email</dt>
              <dd className="break-all">{reservation.guestEmail}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Phone</dt>
              <dd>{reservation.guestPhone}</dd>
            </div>
          </dl>
        </div>

        {reservation.specialRequests && (
          <div className="mt-6 border-t border-card-border pt-6">
            <h2 className="mb-2 text-sm font-semibold text-muted">Special Requests</h2>
            <p>{reservation.specialRequests}</p>
          </div>
        )}

        {table.policies && (
          <div className="mt-6 border-t border-card-border pt-6">
            <h2 className="mb-2 text-sm font-semibold text-muted">Reservation Policy</h2>
            <p className="text-sm text-muted">{table.policies}</p>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <Link
          href="/"
          className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90"
        >
          Make Another Reservation
        </Link>
      </div>
    </main>
  );
}
