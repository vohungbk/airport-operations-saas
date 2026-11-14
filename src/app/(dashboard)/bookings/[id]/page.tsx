import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  FINANCE_ACCESS_PERMISSIONS,
  FINANCE_ADJUSTMENT_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
} from "@/lib/auth/permissions";
import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";
import { getBookingEvents } from "@/features/bookings/lib/get-booking-events";
import { BookingDetail } from "@/features/bookings/components/booking-detail";
import { getFlightUpdates } from "@/features/flights/lib/get-flight-updates";
import { canAddAdjustment } from "@/features/bookings/lib/booking-adjustment";
import { getBookingAdjustments } from "@/features/bookings/lib/get-booking-adjustments";
import { getBookingRevenue } from "@/features/bookings/lib/get-booking-revenue";
import { getBookingPhotos } from "@/features/bookings/lib/get-booking-photos";
import { getChainHistory } from "@/features/return-queue/lib/get-chain-history";
import { resolveBookingPageTab } from "@/features/bookings/lib/booking-tabs";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
  /** `?tab=flight`, `?tab=revenue`, `?tab=timeline` or `?tab=photos` opens that tab; the tab bar of the workflow page links to them. */
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

  // Only admin and operations manager read the chain steps (RLS); for any other role the card is left out.
  const isInternalRole = user.role === "admin" || user.role === "operations_manager";
  const chainHistory = isInternalRole ? await getChainHistory({ bookingId: id }) : null;

  const photos = isInternalRole ? await getBookingPhotos(id) : null;

  const canManage = hasPermission(user.role, "bookings:manage");
  const canViewRevenue = hasAnyPermission(user.role, FINANCE_ACCESS_PERMISSIONS);
  const mayAdjust = hasAnyPermission(user.role, FINANCE_ADJUSTMENT_PERMISSIONS);

  // The revenue is read only for a role that has the Revenue tab. The list of adjustments is for the
  // operations team: a partner user sees the shares and the total, and RLS limits it to its own partner.
  const [revenueRow, adjustments] = canViewRevenue
    ? await Promise.all([getBookingRevenue(id), mayAdjust ? getBookingAdjustments(id) : Promise.resolve(null)])
    : [null, null];

  return (
    <BookingDetail
      booking={booking}
      events={events}
      flightHistory={flightHistory}
      defaultTab={defaultTab}
      canManage={canManage}
      canEnterArrival={isInternalRole}
      chainHistory={chainHistory}
      photos={photos}
      canViewRevenue={canViewRevenue}
      revenue={
        revenueRow ? { row: revenueRow, adjustments, canAdjust: mayAdjust && canAddAdjustment(revenueRow) } : null
      }
    />
  );
}
