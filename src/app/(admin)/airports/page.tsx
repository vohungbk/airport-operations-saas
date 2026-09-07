import Link from "next/link";

import { requirePermission } from "@/lib/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import { getAirports } from "@/features/airports/lib/get-airports";
import { airportsQuerySchema } from "@/features/airports/schemas/airports-query.schema";
import { AirportsFilters } from "@/features/airports/components/airports-filters";
import { AirportsPagination } from "@/features/airports/components/airports-pagination";
import { AirportsTable } from "@/features/airports/components/airports-table";

interface AirportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second `requirePermission` call alongside the layout's —
 * same defense-in-depth precedent as `partners/page.tsx`.
 */
export default async function AirportsPage({ searchParams }: AirportsPageProps) {
  await requirePermission("airports:manage");

  const rawParams = await searchParams;
  const query = airportsQuerySchema.parse(rawParams);
  const { airports, total } = await getAirports(query);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Airports
        </h1>
        <Link href="/airports/new" className={buttonVariants()}>
          Add Airport
        </Link>
      </div>

      <AirportsFilters q={query.q} sort={query.sort} order={query.order} />

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No airports found. Try adjusting the search, or add a new airport.
        </p>
      ) : (
        <>
          <AirportsTable airports={airports} query={query} />
          <AirportsPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
