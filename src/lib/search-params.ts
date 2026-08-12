import { TableLocation } from "@/generated/prisma/client";
import type { SearchInput } from "@/lib/availability";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const LOCATION_VALUES: string[] = Object.values(TableLocation);

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseLocation(value: string | undefined): TableLocation | undefined {
  return value && LOCATION_VALUES.includes(value) ? (value as TableLocation) : undefined;
}

/** True once the guest has submitted the search form at least once. */
export function hasSearchParams(raw: RawSearchParams): boolean {
  return Boolean(firstValue(raw.date) || firstValue(raw.time) || firstValue(raw.partySize));
}

export function parseSearchParams(raw: RawSearchParams): SearchInput {
  const partySizeRaw = firstValue(raw.partySize);
  return {
    date: firstValue(raw.date) ?? "",
    time: firstValue(raw.time) ?? "",
    partySize: partySizeRaw ? Number(partySizeRaw) : NaN,
    location: parseLocation(firstValue(raw.location)),
  };
}
