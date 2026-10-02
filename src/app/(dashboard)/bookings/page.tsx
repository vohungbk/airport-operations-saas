import Link from "next/link";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  hasPermission,
} from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { getBookings } from "@/features/bookings/lib/get-bookings";
import { getBookingFilterOptions } from "@/features/bookings/lib/get-booking-form-options";
import { bookingsQuerySchema } from "@/features/bookings/schemas/bookings-query.schema";
import { BookingsFilters } from "@/features/bookings/components/bookings-filters";
import { BookingsPagination } from "@/features/bookings/components/bookings-pagination";
import { BookingsTable } from "@/features/bookings/components/bookings-table";

interface BookingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second guard alongside the layout's — same
 * defense-in-depth precedent as `seats/page.tsx`. A partner_user only
 * ever receives its own partner's rows: RLS, not this page, enforces it.
 */
export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const user = await requireAnyPermission(BOOKINGS_ACCESS_PERMISSIONS);

  const rawParams = await searchParams;
  const requestedQuery = bookingsQuerySchema.parse(rawParams);
  const [{ bookings, total, page }, options] = await Promise.all([
    getBookings(requestedQuery),
    getBookingFilterOptions(),
  ]);
  // An out-of-range page is served as the last valid page.
  const query = { ...requestedQuery, page };
  const canManage = hasPermission(user.role, "bookings:manage");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bookings
        </h1>
        {canManage && (
          <Link href="/bookings/new" className={buttonVariants()}>
            Add Booking
          </Link>
        )}
      </div>

      <BookingsFilters
        q={query.q}
        airportId={query.airport_id}
        status={query.status}
        dateFrom={query.date_from}
        dateTo={query.date_to}
        sort={query.sort}
        order={query.order}
        airports={options.airports}
      />

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "No bookings found. Try adjusting the search or filters, or add a new booking."
            : "No bookings found. Try adjusting the search or filters."}
        </p>
      ) : (
        <>
          <BookingsTable bookings={bookings} query={query} />
          <BookingsPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
