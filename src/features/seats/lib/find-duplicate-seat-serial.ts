import type { PostgrestError } from "@supabase/supabase-js";

import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DuplicateSerialResult =
  | { duplicate: boolean; error?: undefined }
  | { duplicate?: undefined; error: PostgrestError };

/**
 * Early, friendly check only. `seats.serial_number` has a UNIQUE
 * constraint, which is the race-safe authority (`23505` is mapped to
 * `DUPLICATE_SERIAL` by `mapSeatError`).
 */
export async function findDuplicateSeatSerial(
  supabase: ServerSupabaseClient,
  serialNumber: string,
): Promise<DuplicateSerialResult> {
  const { data, error } = await supabase
    .from("seats")
    .select("id")
    .eq("serial_number", serialNumber)
    .limit(1);

  if (error) {
    return { error };
  }

  return { duplicate: (data?.length ?? 0) > 0 };
}
