import { createClient } from "@/lib/supabase/server";
import { publicTokenSchema } from "@/features/seats/lib/seat-qr";
import type { SeatStatus } from "@/features/seats/types";

export interface ScannedSeat {
  id: string;
  serial_number: string;
  status: SeatStatus;
  quarantine_reason: string | null;
  retired_at: string | null;
  category: { name: string } | null;
  airport: { code: string; name: string } | null;
}

/**
 * Explicit columns: what identifies a seat on a scan. No token, price, partner, rental count or
 * booking data (CO-F04-S13, PO Decision Log section 20.2).
 */
export const SCANNED_SEAT_SELECT =
  "id, serial_number, status, quarantine_reason, retired_at, category:seat_categories(name), airport:airports(code, name)";

/**
 * Server-only. The seat a QR code names, or `null` for a malformed token, an unknown token, or a
 * seat RLS hides from this user: the three look the same, so a scan does not tell whether a
 * seat exists outside the user's scope. The user's own client is used, never the service role.
 */
export async function getSeatByPublicToken(token: string): Promise<ScannedSeat | null> {
  if (!publicTokenSchema.safeParse(token).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seats")
    .select(SCANNED_SEAT_SELECT)
    .eq("public_token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as ScannedSeat | null;
}
