import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  BOOKINGS_WRITE_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
} from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { getBookings } from "@/features/bookings/lib/get-bookings";
import { getBookingFilterOptions } from "@/features/bookings/lib/get-booking-form-options";
import { bookingsQuerySchema } from "@/features/bookings/schemas/bookings-query.schema";
import { BookingsFilters } from "@/features/bookings/components/bookings-filters";
import { BookingsPagination } from "@/features/bookings/components/bookings-pagination";
import { BookingsTable } from "@/features/bookings/components/bookings-table";
import { PageEmpty } from "@/components/shared/page-state";
import { BackToPartnerHome } from "@/features/partners/components/back-to-partner-home";

interface BookingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second guard alongside the layout's — same
 * defense-in-depth precedent as `seats/page.tsx`. A partner_user only
 * ever receives its own partner's rows: RLS, not this page, enforces it. This
 * is also the partner bookings view (VI-F03-S02): whoever cannot manage
 * bookings arrives from the partner home and gets a way back to it.
 */
export default async function BookingsPage({
  searchParams,
}: BookingsPageProps) {
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
  // Managers and partner users (for their own partner) may add a booking.
  const canCreate = hasAnyPermission(user.role, BOOKINGS_WRITE_PERMISSIONS);

  const airport = options.airports.find((a) => a.value === query.airport_id);
  const subtitle = `${airport?.label ?? "All airports"} · ${total} booking${total === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      {!canManage && (
        <div>
          <BackToPartnerHome />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Bookings
          </h1>
          {canCreate && (
            <Link
              href="/bookings/new"
              className={buttonVariants({ className: "min-h-11 px-4" })}
            >
              <PlusIcon aria-hidden="true" />
              Create booking
            </Link>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <BookingsFilters
        // The search box keeps what was typed; a new search (or Clear all) starts it again from the address.
        key={query.q ?? ""}
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
        <PageEmpty
          message={
            canCreate
              ? "No bookings found. Try adjusting the search or filters, or add a new booking."
              : "No bookings found. Try adjusting the search or filters."
          }
        />
      ) : (
        <>
          <BookingsTable bookings={bookings} query={query} />
          <BookingsPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
