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
import { resolveBookingPageTab } from "@/features/bookings/lib/booking-tabs";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
  /** `?tab=flight` or `?tab=timeline` opens that tab; the tab bar of the workflow page links to them. */
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

  const canManage = hasPermission(user.role, "bookings:manage");

  return (
    <BookingDetail
      booking={booking}
      events={events}
      defaultTab={defaultTab}
      canManage={canManage}
      canEditOwn={!canManage && hasPermission(user.role, "bookings:manage_own_partner")}
      canViewRevenue={hasAnyPermission(user.role, FINANCE_ACCESS_PERMISSIONS)}
    />
  );
}
