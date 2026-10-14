import { createClient } from "@/lib/supabase/server";
import type { TechnicianOption } from "@/features/jobs/types";

const MAX_OPTIONS = 200;

/**
 * Server-only. Options for the technician filter. RLS decides what the
 * caller can see: admin/ops get every technician, a technician only
 * themselves (the page does not show the filter to them).
 */
export async function getTechnicianOptions(): Promise<TechnicianOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "technician")
    .order("full_name", { ascending: true })
    .limit(MAX_OPTIONS);

  if (error) {
    throw error;
  }

  return data ?? [];
}
