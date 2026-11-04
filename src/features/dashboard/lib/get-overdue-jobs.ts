import { createClient } from "@/lib/supabase/server";
import { applyJobDeadlineFilter } from "@/features/jobs/lib/job-deadline";

/** The jobs list the Overdue tasks tile links to: the same rule as the count. */
export const OVERDUE_JOBS_HREF = "/jobs?deadline=overdue";

/**
 * Server-only. How many jobs are past their deadline and not done, in the scope of the viewer's RLS
 * (admin and operations see every job, a technician their own). It uses the filter of the Overdue chip of
 * the jobs list, so the figure and the list agree. A job with no deadline is never counted. A failed read
 * gives `null` (a dash on the tile), never a made-up 0.
 */
export async function getOverdueJobsCount(
  now: Date = new Date(),
): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await applyJobDeadlineFilter(
      supabase
        .from("technician_jobs")
        .select("id", { count: "exact", head: true }),
      "overdue",
      now,
    );

    return error || count === null ? null : count;
  } catch {
    return null;
  }
}
