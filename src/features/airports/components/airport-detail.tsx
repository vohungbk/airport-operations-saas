import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { AirportRelatedCounts } from "@/features/airports/lib/get-airport-related-counts";
import type { Airport } from "@/features/airports/types";

interface AirportDetailProps {
  airport: Airport;
  relatedCounts: AirportRelatedCounts;
}

interface CountCardProps {
  title: string;
  value: number;
}

function CountCard({ title, value }: CountCardProps) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

/**
 * No delete/deactivate action — F07 has no status column and no
 * irreversible action in scope (plan.md's "Quyết định đã chốt" #3), so
 * unlike `partner-detail.tsx` there is no `Deactivate*Button` here.
 * Related counts are real numbers from `getAirportRelatedCounts`, not a
 * placeholder — see plan.md's "Quyết định đã chốt" #1.
 */
export function AirportDetail({ airport, relatedCounts }: AirportDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {airport.name}
          </h1>
          <p className="text-sm text-muted-foreground">Code: {airport.code}</p>
        </div>
        <Link
          href={`/airports/${airport.id}/edit`}
          className={buttonVariants({ variant: "outline" })}
        >
          Edit
        </Link>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">City</dt>
          <dd className="mt-1 text-sm text-foreground">{airport.city}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Country</dt>
          <dd className="mt-1 text-sm text-foreground">{airport.country}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Timezone</dt>
          <dd className="mt-1 text-sm text-foreground">{airport.timezone}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Created</dt>
          <dd className="mt-1 text-sm text-foreground">
            {new Date(airport.created_at).toLocaleDateString()}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CountCard title="Seats" value={relatedCounts.seats} />
        <CountCard title="Bookings" value={relatedCounts.bookings} />
        <CountCard title="Flights" value={relatedCounts.flights} />
      </div>
    </div>
  );
}
