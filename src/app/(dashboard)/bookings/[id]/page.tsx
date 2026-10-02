import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_ACCESS_PERMISSIONS,
  hasPermission,
} from "@/lib/auth/permissions";
import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";
import { getBookingEvents } from "@/features/bookings/lib/get-booking-events";
import { BookingDetail } from "@/features/bookings/components/booking-detail";

interface BookingDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const user = await requireAnyPermission(BOOKINGS_ACCESS_PERMISSIONS);

  const { id } = await params;
  // Events only need the route id, so both queries run in parallel.
  const [booking, events] = await Promise.all([
    getBookingById(id),
    getBookingEvents(id),
  ]);

  if (!booking) {
    notFound();
  }

  return (
    <BookingDetail
      booking={booking}
      events={events}
      canManage={hasPermission(user.role, "bookings:manage")}
    />
  );
}
