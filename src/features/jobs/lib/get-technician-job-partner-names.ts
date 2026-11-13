import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Server-only (VI-F11-T02). The display name of the partner of each given job that is assigned to the signed-in
 * technician, by job id, in one call (no read per job). A technician cannot read the partners table, so the name
 * comes from a function that returns only the job id and the name. A job that is not theirs has no entry, and a
 * read that fails gives no name at all: the screen writes a dash, which is what it wrote before.
 */
export async function getTechnicianJobPartnerNames(
  supabase: SupabaseClient<Database>,
  jobIds: readonly string[],
): Promise<Map<string, string>> {
  if (jobIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc("technician_job_partner_names", { p_job_ids: [...jobIds] });

  if (error || !data) return new Map();

  return new Map(data.map((row) => [row.job_id, row.partner_name]));
}
