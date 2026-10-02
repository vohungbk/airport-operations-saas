import Link from "next/link";

import { requirePermission } from "@/lib/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import { getSeats } from "@/features/seats/lib/get-seats";
import { getSeatFormOptions } from "@/features/seats/lib/get-seat-form-options";
import { seatsQuerySchema } from "@/features/seats/schemas/seats-query.schema";
import { SeatsFilters } from "@/features/seats/components/seats-filters";
import { SeatsPagination } from "@/features/seats/components/seats-pagination";
import { SeatsTable } from "@/features/seats/components/seats-table";

interface SeatsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second `requirePermission` call alongside the layout's —
 * same defense-in-depth precedent as `seat-categories/page.tsx`.
 */
export default async function SeatsPage({ searchParams }: SeatsPageProps) {
  await requirePermission("seats:manage");

  const rawParams = await searchParams;
  const requestedQuery = seatsQuerySchema.parse(rawParams);
  const [{ seats, total, page }, options] = await Promise.all([
    getSeats(requestedQuery),
    getSeatFormOptions(),
  ]);
  // An out-of-range page is served as the last valid page.
  const query = { ...requestedQuery, page };

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Seats
        </h1>
        <Link href="/seats/new" className={buttonVariants()}>
          Add Seat
        </Link>
      </div>

      <SeatsFilters
        q={query.q}
        airportId={query.airport_id}
        categoryId={query.category_id}
        status={query.status}
        sort={query.sort}
        order={query.order}
        airports={options.airports}
        categories={options.categories}
      />

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No seats found. Try adjusting the search or filters, or add a new
          seat.
        </p>
      ) : (
        <>
          <SeatsTable seats={seats} query={query} />
          <SeatsPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
