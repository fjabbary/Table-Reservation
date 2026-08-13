// Pure timezone-conversion helpers, using only the built-in Intl API — no
// dependency needed. These exist because JavaScript's `new Date(y, m, d, h, min)`
// and `.setHours(...)` always use the *runtime's own* local timezone, which is
// wrong for this app: a guest's "7:00 PM" always means 7:00 PM at the
// restaurant's physical location, regardless of what timezone the Node
// process (dev laptop vs. a cloud server) happens to be running in.

/** The UTC offset (in minutes) of `timeZone` at the instant `date` represents. */
function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (asUtc - date.getTime()) / 60_000;
}

function getDateTimeParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const raw: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") raw[part.type] = part.value;
  }
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour: Number(raw.hour),
    minute: Number(raw.minute),
    second: Number(raw.second),
  };
}

/**
 * Converts a wall-clock date/time — as it would read on a clock in
 * `timeZone` — into the absolute instant it represents. Correctly accounts
 * for DST by resolving the zone's actual offset at that instant.
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-indexed
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

/** The wall-clock year/month/day/hour/minute `date` reads as in `timeZone`. */
export function getZonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number } {
  const { year, month, day, hour, minute } = getDateTimeParts(date, timeZone);
  return { year, month, day, hour, minute };
}
