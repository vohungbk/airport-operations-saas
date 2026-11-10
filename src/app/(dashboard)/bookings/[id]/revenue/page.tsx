import { redirect } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

interface BookingRevenuePageProps {
  params: Promise<{ id: string }>;
}

/**
 * UI-F06-T04: the revenue of a booking is the Revenue tab of the booking page. This address stays for old
 * links and sends the user there. The finance permission is checked first, so a technician gets the
 * forbidden page, not the booking.
 */
export default async function BookingRevenuePage({ params }: BookingRevenuePageProps) {
  await requireAnyPermission(FINANCE_ACCESS_PERMISSIONS);

  const { id } = await params;
  redirect(`/bookings/${encodeURIComponent(id)}?tab=revenue`);
}
