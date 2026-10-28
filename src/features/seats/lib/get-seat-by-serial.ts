import { createClient } from "@/lib/supabase/server";
import { SCANNED_SEAT_SELECT, type ScannedSeat } from "@/features/seats/lib/get-seat-by-token";

/** `_` and `%` mean "any" to `ilike`; in a serial number they are characters. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/**
 * Server-only. The seat with this serial number, or `null` for an unknown serial or a seat RLS hides from
 * this user: the two look the same, so a typed code does not tell whether a seat exists outside the user's
 * scope. A serial is free text, so the exact text is looked for first; failing that, the same text in another
 * case, and only when that names one seat. The user's own client is used, never the service role.
 */
export async function getSeatBySerial(serial: string): Promise<ScannedSeat | null> {
  const supabase = await createClient();
  const exact = await supabase.from("seats").select(SCANNED_SEAT_SELECT).eq("serial_number", serial).maybeSingle();

  if (exact.error) {
    throw exact.error;
  }
  if (exact.data) {
    return exact.data as unknown as ScannedSeat;
  }

  const anyCase = await supabase
    .from("seats")
    .select(SCANNED_SEAT_SELECT)
    .ilike("serial_number", escapeLike(serial))
    .limit(2);

  if (anyCase.error) {
    throw anyCase.error;
  }

  return anyCase.data?.length === 1 ? (anyCase.data[0] as unknown as ScannedSeat) : null;
}
