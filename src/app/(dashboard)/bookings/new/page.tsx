import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  BOOKINGS_WRITE_PERMISSIONS,
  hasPermission,
} from "@/lib/auth/permissions";
import { CreateBookingForm } from "@/features/bookings/components/create-booking-form";
import { CreatePartnerBookingForm } from "@/features/bookings/components/create-partner-booking-form";
import {
  getBookingFormOptions,
  getPartnerBookingFormOptions,
} from "@/features/bookings/lib/get-booking-form-options";

/**
 * Managers (`bookings:manage`) create for any partner. A partner user
 * (`bookings:manage_own_partner`) gets the partner form: no partner and no
 * seat to pick. The server action and the database function check the caller
 * again; this guard only decides who sees the page.
 */
export default async function NewBookingPage() {
  const user = await requireAnyPermission(BOOKINGS_WRITE_PERMISSIONS);

  const form = hasPermission(user.role, "bookings:manage") ? (
    <CreateBookingForm options={await getBookingFormOptions()} />
  ) : (
    <CreatePartnerBookingForm options={await getPartnerBookingFormOptions()} />
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Add booking
      </h1>
      <div className="max-w-lg">{form}</div>
    </div>
  );
}
