import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";

interface Option {
  value: string;
  label: string;
}

/** A technician in the picker. A deactivated one is listed but cannot be chosen. */
export interface TechnicianOption extends Option {
  is_active: boolean;
  /** Airport of the most recently assigned job; null until the first job. */
  airport_code: string | null;
}

export interface JobFormOptions {
  technicians: TechnicianOption[];
  bookings: Option[];
}

/** The part of a `technician_list_figures` row used here; the server client is untyped. */
interface TechnicianAirportRow {
  technician_id: string;
  airport_code: string | null;
}

const MAX_OPTIONS = 200;

/**
 * Server-only dropdown data for the job form (admin/ops only — the caller
 * guards with `technicians:manage`). Active technicians come first, then the
 * deactivated ones, which the picker shows as unavailable. Only active
 * bookings are offered; the guard triggers enforce the same rules.
 */
export async function getJobFormOptions(): Promise<JobFormOptions> {
  const supabase = await createClient();

  const [technicians, bookings] = await Promise.all([
    supabase
      .from("users")
      .select("id, full_name, is_active")
      .eq("role", "technician")
      .order("is_active", { ascending: false })
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

  const users = technicians.data ?? [];

  // One call for the whole list keeps this free of N+1 queries.
  const figures =
    users.length === 0
      ? { data: [], error: null }
      : await supabase.rpc("technician_list_figures", {
          p_technician_ids: users.map((user) => user.id),
        });

  if (figures.error) {
    throw figures.error;
  }

  const airportCodes = new Map(
    ((figures.data ?? []) as TechnicianAirportRow[]).map((row) => [
      row.technician_id,
      row.airport_code,
    ]),
  );

  return {
    technicians: users.map((technician) => ({
      value: technician.id,
      label: technician.full_name,
      is_active: technician.is_active,
      airport_code: airportCodes.get(technician.id) ?? null,
    })),
    bookings: (bookings.data ?? []).map((booking) => ({
      value: booking.id,
      label: booking.booking_number,
    })),
  };
}
