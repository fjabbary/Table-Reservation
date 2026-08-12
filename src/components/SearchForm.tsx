import { TableLocation } from "@/generated/prisma/client";
import { MAX_PARTY_SIZE } from "@/lib/constants";
import { formatLocation, toDateInputValue } from "@/lib/format";

type SearchFormProps = {
  defaultDate?: string;
  defaultTime?: string;
  defaultPartySize?: number;
  defaultLocation?: string;
  /** Where the form submits to. Defaults to the results page. */
  action?: string;
};

export function SearchForm({
  defaultDate,
  defaultTime = "19:00",
  defaultPartySize = 2,
  defaultLocation = "",
  action = "/search",
}: SearchFormProps) {
  const today = toDateInputValue(new Date());

  return (
    <form
      action={action}
      method="get"
      className="grid grid-cols-1 gap-4 rounded-2xl border border-card-border bg-card p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="date" className="text-sm font-medium text-muted">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          required
          min={today}
          defaultValue={defaultDate ?? today}
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="time" className="text-sm font-medium text-muted">
          Time
        </label>
        <input
          id="time"
          name="time"
          type="time"
          required
          defaultValue={defaultTime}
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="partySize" className="text-sm font-medium text-muted">
          Party size
        </label>
        <input
          id="partySize"
          name="partySize"
          type="number"
          required
          min={1}
          max={MAX_PARTY_SIZE}
          defaultValue={defaultPartySize}
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="location" className="text-sm font-medium text-muted">
          Location
        </label>
        <select
          id="location"
          name="location"
          defaultValue={defaultLocation}
          className="rounded-lg border border-card-border bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
        >
          <option value="">Any location</option>
          {Object.values(TableLocation).map((location) => (
            <option key={location} value={location}>
              {formatLocation(location)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Find a Table
      </button>
    </form>
  );
}
