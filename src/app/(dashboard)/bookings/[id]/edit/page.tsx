import { notFound, redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getBookingById } from "@/features/bookings/lib/get-booking-by-id";
import { isBookingEditable } from "@/features/bookings/lib/booking-status";
import { EditBookingForm } from "@/features/bookings/components/edit-booking-form";

interface EditBookingPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBookingPage({
  params,
}: EditBookingPageProps) {
  await requirePermission("bookings:manage");

  const { id } = await params;
  const booking = await getBookingById(id);

  // Without the airport the times cannot be shown or saved correctly.
  if (!booking?.airport) {
    notFound();
  }

  // Terminal and workflow-owned bookings are view-only.
  if (!isBookingEditable(booking.status)) {
    redirect(`/bookings/${booking.id}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Edit booking {booking.booking_number}
      </h1>
      <div className="max-w-lg">
        <EditBookingForm
          booking={booking}
          timeZone={booking.airport.timezone}
        />
      </div>
    </div>
  );
}
