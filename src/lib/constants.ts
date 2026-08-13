// App-level assumptions, since the spec doesn't pin these down.
// Centralized here so the seed script, availability search, and reservation
// creation all agree on the same numbers.

/** How long a single reservation occupies its table. */
export const RESERVATION_DURATION_MINUTES = 90;

/** Restaurant opening hour (24h, local time). */
export const OPENING_HOUR = 11;

/** Restaurant closing hour (24h, local time) — last reservation must end by then. */
export const CLOSING_HOUR = 22;

/** Sanity cap on a single reservation's party size; larger groups should call in. */
export const MAX_PARTY_SIZE = 20;

/**
 * The restaurant's fixed physical timezone. All date/time parsing and
 * display is anchored to this — never to the server's or guest's own
 * timezone — so "7:00 PM" means the same absolute instant no matter where
 * the app happens to be running (a dev laptop vs. a cloud server in a
 * different timezone are otherwise a real source of bugs here).
 */
export const RESTAURANT_TIMEZONE = "America/Los_Angeles";
