import { createClient } from "@/lib/supabase/server";
import {
  SEAT_WITH_RELATIONS_SELECT,
  type SeatDetailItem,
} from "@/features/seats/lib/get-seats";
import { seatIdSchema } from "@/features/seats/schemas/seat.schema";

/**
 * Server-only. Returns `null` for an unknown id, an id RLS hides, or a
 * malformed id — the caller turns that into `notFound()`.
 */
export async function getSeatById(id: string): Promise<SeatDetailItem | null> {
  if (!seatIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seats")
    .select(SEAT_WITH_RELATIONS_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as unknown as SeatDetailItem | null;
}
