import { requirePermission } from "@/lib/auth/current-user";
import { CreateBookingForm } from "@/features/bookings/components/create-booking-form";
import { getBookingFormOptions } from "@/features/bookings/lib/get-booking-form-options";

export default async function NewBookingPage() {
  await requirePermission("bookings:manage");

  const options = await getBookingFormOptions();

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add booking
      </h1>
      <div className="max-w-lg">
        <CreateBookingForm options={options} />
      </div>
    </div>
  );
}
