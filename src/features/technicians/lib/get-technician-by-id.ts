import { createClient } from "@/lib/supabase/server";
import { TECHNICIAN_COLUMNS } from "@/features/technicians/lib/technician-columns";
import { technicianIdSchema } from "@/features/technicians/schemas/technicians-query.schema";
import type { Technician } from "@/features/technicians/types";

/**
 * Server-only. Returns `null` for a malformed id, an unknown id, a user
 * that is not a technician, or a row RLS hides — the caller turns that
 * into `notFound()`.
 */
export async function getTechnicianById(
  id: string,
): Promise<Technician | null> {
  if (!technicianIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(TECHNICIAN_COLUMNS)
    .eq("id", id)
    .eq("role", "technician")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
