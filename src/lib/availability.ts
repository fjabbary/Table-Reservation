import { db } from "@/lib/db";
import {
  CLOSING_HOUR,
  MAX_PARTY_SIZE,
  OPENING_HOUR,
  RESERVATION_DURATION_MINUTES,
} from "@/lib/constants";
import type {
  PrismaClient,
  Table,
  TableLocation,
} from "@/generated/prisma/client";

export type SearchInput = {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm", 24h */
  time: string;
  partySize: number;
  location?: TableLocation;
};

export type ValidatedSearch = {
  start: Date;
  end: Date;
  partySize: number;
  location?: TableLocation;
};

export type ValidationResult =
  | { valid: true; value: ValidatedSearch }
  | { valid: false; error: string };

/**
 * Parses a "YYYY-MM-DD" date and "HH:mm" time into a single local Date.
 * Returns null for malformed input or calendar-invalid dates (e.g. Feb 31).
 */
export function combineDateAndTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  // Date() silently rolls over invalid days (e.g. Feb 31 -> Mar 3) — reject those.
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }
  return result;
}

/** The [start, end) window a reservation occupies on its table. */
export function getReservationWindow(start: Date): { start: Date; end: Date } {
  return {
    start,
    end: new Date(start.getTime() + RESERVATION_DURATION_MINUTES * 60_000),
  };
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

/**
 * Validates raw search form input against real-world constraints: valid
 * date/time, non-past, sane party size, and within operating hours.
 * `now` is injectable for deterministic tests.
 */
export function validateSearchInput(
  input: SearchInput,
  now: Date = new Date()
): ValidationResult {
  const start = combineDateAndTime(input.date, input.time);
  if (!start) {
    return {
      valid: false,
      error: "Please enter a valid reservation date and time.",
    };
  }

  if (!Number.isInteger(input.partySize) || input.partySize < 1) {
    return { valid: false, error: "Party size must be at least 1." };
  }
  if (input.partySize > MAX_PARTY_SIZE) {
    return {
      valid: false,
      error: `Party size can't exceed ${MAX_PARTY_SIZE}. Please contact us directly for larger groups.`,
    };
  }

  if (start.getTime() < now.getTime()) {
    return { valid: false, error: "Reservation time can't be in the past." };
  }

  const { end } = getReservationWindow(start);
  const openingTime = new Date(start);
  openingTime.setHours(OPENING_HOUR, 0, 0, 0);
  const closingTime = new Date(start);
  closingTime.setHours(CLOSING_HOUR, 0, 0, 0);

  if (
    start.getTime() < openingTime.getTime() ||
    end.getTime() > closingTime.getTime()
  ) {
    return {
      valid: false,
      error: `Please choose a time between ${formatHour(
        OPENING_HOUR
      )} and ${formatHour(
        CLOSING_HOUR
      )} (reservations run ${RESERVATION_DURATION_MINUTES} minutes).`,
    };
  }

  return {
    valid: true,
    value: { start, end, partySize: input.partySize, location: input.location },
  };
}

/**
 * Finds tables that fit the party and have no overlapping reservation in the
 * requested window. Takes an already-validated search — call
 * `validateSearchInput` first. `client` is injectable so tests can point this
 * at an isolated database instead of the app's real one.
 */
export async function findAvailableTables(
  { start, end, partySize, location }: ValidatedSearch,
  client: Pick<PrismaClient, "table" | "reservation"> = db
): Promise<Table[]> {
  const candidates = await client.table.findMany({
    where: {
      capacity: { gte: partySize },
      ...(location ? { location } : {}),
    },
    orderBy: [{ capacity: "asc" }, { name: "asc" }],
  });

  if (candidates.length === 0) return [];

  // Any existing reservation whose [start, start+duration) window could
  // possibly overlap ours starts somewhere in (requestedStart - duration, requestedEnd).
  const conflictWindowStart = new Date(
    start.getTime() - RESERVATION_DURATION_MINUTES * 60_000
  );
  const conflicts = await client.reservation.findMany({
    where: {
      tableId: { in: candidates.map((t) => t.id) },
      startTime: { gt: conflictWindowStart, lt: end },
    },
    select: { tableId: true },
  });
  const conflictedTableIds = new Set(conflicts.map((r) => r.tableId));

  return candidates.filter((table) => !conflictedTableIds.has(table.id));
}
