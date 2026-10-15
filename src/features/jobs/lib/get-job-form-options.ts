import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";

interface Option {
  value: string;
  label: string;
}

export interface JobFormOptions {
  technicians: Option[];
  bookings: Option[];
}

const MAX_OPTIONS = 200;

/**
 * Server-only dropdown data for the job form (admin/ops only — the caller
 * guards with `technicians:manage`). Only active technicians and active
 * bookings are offered; the insert guard trigger enforces the same rules.
 */
export async function getJobFormOptions(): Promise<JobFormOptions> {
  const supabase = await createClient();

  const [technicians, bookings] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name")
      .eq("role", "technician")
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .limit(MAX_OPTIONS),
    supabase
      .from("bookings")
      .select("id, booking_number")
      .in("status", [...ACTIVE_BOOKING_STATUSES])
      .order("pickup_at", { ascending: false })
      .limit(MAX_OPTIONS),
  ]);

  for (const { error } of [technicians, bookings]) {
    if (error) {
      throw error;
    }
  }

  return {
    technicians: (technicians.data ?? []).map((technician) => ({
      value: technician.id,
      label: technician.full_name,
    })),
    bookings: (bookings.data ?? []).map((booking) => ({
      value: booking.id,
      label: booking.booking_number,
    })),
  };
}
