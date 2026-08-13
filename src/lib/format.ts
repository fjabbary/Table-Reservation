import type { TableLocation } from "@/generated/prisma/client";
import { RESTAURANT_TIMEZONE } from "@/lib/constants";
import { getZonedParts } from "@/lib/timezone";

const LOCATION_LABELS: Record<TableLocation, string> = {
  INDOOR: "Indoor",
  PATIO: "Patio",
  BAR: "Bar",
  PRIVATE_DINING: "Private Dining",
};

export function formatLocation(location: TableLocation): string {
  return LOCATION_LABELS[location];
}

/** `features` is stored as a comma-separated string (SQLite has no array type). */
export function parseFeatures(features: string | null): string[] {
  if (!features) return [];
  return features
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
}

// All of these are explicitly pinned to RESTAURANT_TIMEZONE, not the
// runtime's own timezone — otherwise "7:00 PM" would display differently
// depending on whether it's rendered on a dev laptop or a cloud server.

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: RESTAURANT_TIMEZONE,
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: RESTAURANT_TIMEZONE,
  });
}

/** "YYYY-MM-DD", suitable for an <input type="date"> value, as of "today" at the restaurant. */
export function toDateInputValue(date: Date): string {
  const { year, month, day } = getZonedParts(date, RESTAURANT_TIMEZONE);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "HH:mm", suitable for an <input type="time"> value, at the restaurant. */
export function toTimeInputValue(date: Date): string {
  const { hour, minute } = getZonedParts(date, RESTAURANT_TIMEZONE);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
