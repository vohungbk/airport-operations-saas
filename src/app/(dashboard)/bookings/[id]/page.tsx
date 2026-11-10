import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  FINANCE_ACCESS_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
} from "@/lib/auth/permissions";
import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";
import { getBookingEvents } from "@/features/bookings/lib/get-booking-events";
import { BookingDetail } from "@/features/bookings/components/booking-detail";
import { getFlightUpdates } from "@/features/flights/lib/get-flight-updates";
import { resolveBookingPageTab } from "@/features/bookings/lib/booking-tabs";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
  /** `?tab=flight`, `?tab=timeline` or `?tab=photos` opens that tab; the tab bar of the workflow page links to them. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: BookingDetailPageProps) {
  const user = await requireAnyPermission(BOOKINGS_ACCESS_PERMISSIONS);

  const { id } = await params;
  const defaultTab = resolveBookingPageTab((await searchParams)?.tab);
  // Events only need the route id, so both queries run in parallel.
  const [booking, events] = await Promise.all([
    getBookingById(id),
    getBookingEvents(id),
  ]);

  if (!booking) {
    notFound();
  }

  // The history needs the flight of the booking, so it is read once the booking is known. It never
  // throws: a failure is shown inside its own card and the flight card stays (VI-F02-T01 AC05).
  const flightHistory = await getFlightUpdates(booking.flight_id);

  const canManage = hasPermission(user.role, "bookings:manage");

  return (
    <BookingDetail
      booking={booking}
      events={events}
      flightHistory={flightHistory}
      defaultTab={defaultTab}
      canManage={canManage}
      canEnterArrival={user.role === "admin" || user.role === "operations_manager"}
      canViewRevenue={hasAnyPermission(user.role, FINANCE_ACCESS_PERMISSIONS)}
    />
  );
}
