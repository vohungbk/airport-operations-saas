import { createClient } from "@/lib/supabase/server";
import { TODAYS_JOBS_SELECT } from "@/features/jobs/lib/get-todays-jobs";
import { getTechnicianJobPartnerNames } from "@/features/jobs/lib/get-technician-job-partner-names";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";
import { toTodayJob, type TodayJob, type TodayJobRow } from "@/features/jobs/lib/todays-jobs";

/**
 * Server-only (UI-F07-S02). The job a technician opens from Today's Jobs, with the same fields as its card
 * (the columns of `TODAYS_JOBS_SELECT`, so no pricing or revenue share). Returns `null` for a malformed id, an
 * unknown id, a job with no booking, or a job RLS hides (another technician's): the page shows the forbidden
 * state for all of them, so a job that is not the user's looks the same as a missing one. A failed read throws.
 */
export async function getJobInformation(id: string): Promise<TodayJob | null> {
  if (!jobIdSchema.safeParse(id).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(TODAYS_JOBS_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as unknown as TodayJobRow | null;

  if (!row?.booking) {
    return null;
  }

  const partnerNames = await getTechnicianJobPartnerNames(supabase, [row.id]);

  return { ...toTodayJob(row, row.booking), partner_name: partnerNames.get(row.id) ?? null };
}
