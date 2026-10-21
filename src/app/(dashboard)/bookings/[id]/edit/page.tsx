import { notFound, redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_WRITE_PERMISSIONS,
  hasPermission,
} from "@/lib/auth/permissions";
import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";
import {
  isBookingEditable,
  isPartnerBookingEditable,
} from "@/features/bookings/lib/booking-status";
import { EditBookingForm } from "@/features/bookings/components/edit-booking-form";
import { EditPartnerBookingForm } from "@/features/bookings/components/edit-partner-booking-form";

interface EditBookingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBookingPage({
  params,
}: EditBookingPageProps) {
  const user = await requireAnyPermission(BOOKINGS_WRITE_PERMISSIONS);
  const isManager = hasPermission(user.role, "bookings:manage");

  const { id } = await params;
  const booking = await getBookingById(id);

  // Without the airport the times cannot be shown or saved correctly. A
  // partner user is only ever given their own partner's rows (RLS), so another
  // partner's booking is not found here either.
  if (!booking?.airport) {
    notFound();
  }

  // Terminal and workflow-owned bookings are view-only; a partner user can edit
  // only a pending one.
  const editable = isManager
    ? isBookingEditable(booking.status)
    : isPartnerBookingEditable(booking.status);

  if (!editable) {
    redirect(`/bookings/${booking.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Edit booking {booking.booking_number}
      </h1>
      <div className="max-w-lg">
        {isManager ? (
          <EditBookingForm
            booking={booking}
            timeZone={booking.airport.timezone}
          />
        ) : (
          <EditPartnerBookingForm
            booking={booking}
            timeZone={booking.airport.timezone}
          />
        )}
      </div>
    </div>
  );
}
