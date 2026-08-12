# Amber Table — Restaurant Reservation App

A full-stack table reservation web app: guests search availability by date/time/party size,
browse tables, view details, and book — with real conflict detection so no table is ever
double-booked.

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **Prisma 7** + **SQLite** (via the `@prisma/adapter-better-sqlite3` driver adapter)
- **Zod** for server-side form validation
- **Vitest** for unit tests
- No authentication — guests provide name, email, and phone directly on the reservation form.

## Getting Started

```bash
npm install
cp .env.example .env        # sets DATABASE_URL="file:./dev.db"
npx prisma migrate dev      # creates dev.db and applies the schema
npx prisma generate         # generates the Prisma client into src/generated/prisma
npm run db:seed             # seeds 10 sample tables + 4 sample reservations
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run test` | Run the Vitest suite (availability/conflict-detection logic) |
| `npm run db:seed` | Re-seed the database (safe to re-run — wipes and recreates sample data) |
| `npx prisma studio` | Visual database browser at `localhost:5555` |

## How It Works

The app has no separate REST API — it's built as Server Components reading URL search
params directly (`/search?date=&time=&partySize=`), plus a single Server Action
(`createReservation`) for the reservation form. This means most pages work even with
JavaScript disabled, since search is a plain `<form method="get">` and the browser does
the navigation.

**Reservation flow:** `/` (search form) → `/search` (results) → `/tables/[id]` (detail) →
`/tables/[id]/reserve` (guest info form) → `/reservations/[reference]` (confirmation).

**Conflict detection** (`src/lib/availability.ts`) is the core logic: every reservation
occupies a fixed 90-minute window starting at its booked time; a table is available for a
requested slot only if no existing reservation's window overlaps it. The check uses strict
inequalities, so back-to-back bookings are allowed — a table freed at 8:30pm can be
re-booked by someone starting at exactly 8:30pm. Availability is re-checked immediately
before creating a reservation, inside a database transaction, so two guests can't both win
a race for the same table and time.

## Key Assumptions

The spec left a few real-world details unspecified; these are documented, centralized
choices (mostly in `src/lib/constants.ts`) rather than hardcoded magic numbers:

- **Single restaurant, multiple tables** — not a multi-restaurant marketplace.
- **Fixed 90-minute reservation duration** for every booking.
- **Operating hours: 11:00 AM – 10:00 PM** — the full 90-minute window must fit inside
  these hours (last bookable slot is 8:30 PM).
- **Max party size: 20** — larger groups are asked to contact the restaurant directly.
- **Reference numbers** look like `RES-7K3M9P` (6 characters, uppercase, excluding
  visually ambiguous characters like `0`/`O` and `1`/`I`).
- **Phone numbers** must be exactly 10 digits, no formatting characters.

## Project Structure

```
prisma/
  schema.prisma        Table + Reservation models
  seed.ts               Sample data (10 tables, 4 pre-existing reservations)
src/
  lib/
    availability.ts     Core search/conflict-detection logic (+ tests)
    db.ts                Prisma client singleton
    constants.ts         Reservation duration, operating hours, etc.
    format.ts             Display formatting helpers
    search-params.ts      URL search param parsing
    reference-number.ts   Reservation reference code generator
  components/            Shared UI (SearchForm, TableCard, LocationBadge, ...)
  app/
    page.tsx               Home (search form)
    search/page.tsx          Search results
    tables/[id]/page.tsx       Table detail
    tables/[id]/reserve/         Reservation form + Server Action
    reservations/[reference]/     Confirmation page
```

## Testing

```bash
npm run test
```

Runs against an isolated `prisma/test.db` (gitignored, pushed fresh from the schema and
wiped between tests) — never touches your seeded `dev.db`. Covers date/time parsing edge
cases, all search-validation rules, and every conflict scenario (exact overlap, partial
overlap, both back-to-back directions, capacity/location filtering).

## Known Limitations

Out of scope for this assessment: user accounts/authentication, reservation
cancellation/editing, an admin/staff view, and a REST API layer (the Server Actions
architecture intentionally skips one — see "How It Works" above).
