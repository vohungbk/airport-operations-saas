import { createClient } from "@/lib/supabase/server";
import { OPEN_JOB_STATUSES } from "@/features/jobs/lib/job-deadline";
import { ATTENTION_LIST_LIMIT, type AttentionList } from "@/features/dashboard/lib/attention-list";
import { toJobAttentionItem, type OverdueJobRow } from "@/features/dashboard/lib/get-overdue-list";

/** The jobs list the Technician assignments rows link to; it shows the technician of every job. */
export const TECHNICIAN_ASSIGNMENTS_HREF = "/jobs";

export interface TechnicianAssignmentRow extends OverdueJobRow {
  technician: { full_name: string | null } | null;
}

/** One nested select (job + technician + booking + airport), never a per-row lookup. */
const ASSIGNMENTS_SELECT =
  "id, job_number, job_type, status, deadline_at, technician:users!technician_id(full_name), booking:bookings!inner(airport:airports(timezone))";

/** Pure. Technician, job and deadline per row; the query sorts the nearest deadline first. */
export function toTechnicianAssignmentList(
  rows: readonly TechnicianAssignmentRow[],
  count: number,
): AttentionList {
  return {
    count,
    items: rows.map((row) => toJobAttentionItem(row, row.technician?.full_name)),
  };
}

/**
 * Server-only. The first open jobs (assigned or in progress) of the Command Centre with the total
 * (VI-F11-S07), read as the signed-in user so RLS is the scope. The nearest deadline comes first and a job
 * with no deadline last. A failed read gives `null` (a dash), never an empty list.
 */
export async function getTechnicianAssignments(): Promise<AttentionList | null> {
  try {
    const supabase = await createClient();
    const { data, count, error } = await supabase
      .from("technician_jobs")
      .select(ASSIGNMENTS_SELECT, { count: "exact" })
      .in("status", OPEN_JOB_STATUSES)
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(ATTENTION_LIST_LIMIT);

    return error || !data || count === null
      ? null
      : toTechnicianAssignmentList(data as unknown as TechnicianAssignmentRow[], count);
  } catch {
    return null;
  }
}
