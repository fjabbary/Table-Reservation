import type { TableLocation } from "@/generated/prisma/client";
import { formatLocation } from "@/lib/format";

const LOCATION_STYLES: Record<TableLocation, string> = {
  INDOOR: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  PATIO: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  BAR: "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-200",
  PRIVATE_DINING: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200",
};

export function LocationBadge({ location }: { location: TableLocation }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LOCATION_STYLES[location]}`}
    >
      {formatLocation(location)}
    </span>
  );
}
