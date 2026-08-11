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
