import type { TableLocation } from "@/generated/prisma/client";

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

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "YYYY-MM-DD", suitable for an <input type="date"> value, in local time. */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "HH:mm", suitable for an <input type="time"> value, in local time. */
export function toTimeInputValue(date: Date): string {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}
