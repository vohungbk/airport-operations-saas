import Link from "next/link";

import { requirePermission } from "@/lib/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import { getSeats } from "@/features/seats/lib/get-seats";
import { getSeatFormOptions } from "@/features/seats/lib/get-seat-form-options";
import { seatsQuerySchema } from "@/features/seats/schemas/seats-query.schema";
import { SeatsFilters } from "@/features/seats/components/seats-filters";
import { SeatsPagination } from "@/features/seats/components/seats-pagination";
import { SeatsTable } from "@/features/seats/components/seats-table";
import { PageEmpty } from "@/components/shared/page-state";

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
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl leading-8 font-semibold text-primary-subtle-foreground">
            Seats
          </h1>
          <p className="text-sm leading-5 text-text-muted">
            Manage seat inventory across airports
          </p>
        </div>
        <Link href="/seats/new" className={buttonVariants({ className: "min-h-11 rounded-lg" })}>
          Create seat
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
        <PageEmpty
          message="No seats found. Try adjusting the search or filters, or add a new seat."
        />
      ) : (
        <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <SeatsTable seats={seats} />
          <div className="border-t border-border">
            <SeatsPagination query={query} total={total} />
          </div>
        </div>
      )}
    </div>
  );
}
