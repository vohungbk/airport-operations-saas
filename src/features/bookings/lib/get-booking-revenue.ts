import { createClient } from "@/lib/supabase/server";
import { bookingIdSchema } from "@/features/bookings/schemas/booking.schema";

export interface BookingRevenueRow {
  id: string;
  booking_number: string;
  status: string;
  daily_rate: number;
  paid_days: number;
  rental_days: number | null;
  gross_revenue: number | null;
  partner_share: number | null;
  platform_share: number | null;
  launch_credit: number;
  launch_credit_balance: number | null;
  revenue_case: string | null;
  revenue_flag: string | null;
  /** The version of the terms the shares were calculated with, if any. */
  terms: {
    partner_share_percent: number;
    platform_share_percent: number;
    launch_partner_share_percent: number;
    effective_from: string;
  } | null;
}

/**
 * Explicit columns (VI-F04-S08): the figures of one booking and the shares and the start date of
 * the terms it used. No fees, no launch credit target, no partner data.
 */
export const BOOKING_REVENUE_SELECT = [
  "id",
  "booking_number",
  "status",
  "daily_rate",
  "paid_days",
  "rental_days",
  "gross_revenue",
  "partner_share",
  "platform_share",
  "launch_credit",
  "launch_credit_balance",
  "revenue_case",
  "revenue_flag",
  "terms:partner_commercial_terms!commercial_terms_id(partner_share_percent, platform_share_percent, launch_partner_share_percent, effective_from)",
].join(", ");

/**
 * Server-only, one query with the user's own client. `null` for a malformed id, an unknown id, or
 * a booking RLS hides (a partner user gets only the bookings of its own partner): the caller turns
 * all three into the same not-found page.
 */
export async function getBookingRevenue(id: string): Promise<BookingRevenueRow | null> {
  if (!bookingIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_REVENUE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as BookingRevenueRow | null;
}
