import { createClient } from "@/lib/supabase/server";
import { applyJobDeadlineFilter, formatJobDeadline } from "@/features/jobs/lib/job-deadline";
import { JOB_STATUS_LABEL, type JobStatus } from "@/features/jobs/lib/job-status";
import { JOB_TYPE_LABEL, type JobType } from "@/features/jobs/lib/job-type";
import { ATTENTION_LIST_LIMIT, type AttentionList, type AttentionListItem } from "@/features/dashboard/lib/attention-list";

export interface OverdueJobRow {
  id: string;
  job_number: string;
  job_type: string;
  status: string;
  deadline_at: string | null;
  booking: { airport: { timezone: string } | null } | null;
}

/** One nested select (job + booking + airport), never a per-row lookup. */
const OVERDUE_LIST_SELECT =
  "id, job_number, job_type, status, deadline_at, booking:bookings!inner(airport:airports(timezone))";

/** Pure. One job as a row of a list: its number, type and deadline (in the airport's zone, UTC if none), after an optional prefix. */
export function toJobAttentionItem(row: OverdueJobRow, prefix?: string | null): AttentionListItem {
  return {
    id: row.id,
    href: `/jobs/${row.id}`,
    label: [
      prefix,
      row.job_number,
      JOB_TYPE_LABEL[row.job_type as JobType] ?? row.job_type,
      row.deadline_at && formatJobDeadline(row.deadline_at, row.booking?.airport?.timezone ?? "UTC"),
    ]
      .filter(Boolean)
      .join(" · "),
    status_label: JOB_STATUS_LABEL[row.status as JobStatus] ?? row.status,
  };
}

/** Pure. The oldest deadline comes first because the query sorts by it. */
export function toOverdueList(rows: readonly OverdueJobRow[], count: number): AttentionList {
  return { count, items: rows.map((row) => toJobAttentionItem(row)) };
}

/**
 * Server-only. The first overdue jobs of the Command Centre (VI-F11-S08) with the total, by the same rule as
 * the Overdue tasks tile and the Overdue chip of the jobs list, read as the signed-in user so RLS is the
 * scope. The longest overdue job comes first. A failed read gives `null` (a dash), never an empty list.
 */
export async function getOverdueList(now: Date = new Date()): Promise<AttentionList | null> {
  try {
    const supabase = await createClient();
    const { data, count, error } = await applyJobDeadlineFilter(
      supabase.from("technician_jobs").select(OVERDUE_LIST_SELECT, { count: "exact" }),
      "overdue",
      now,
    )
      .order("deadline_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(ATTENTION_LIST_LIMIT);

    return error || !data || count === null ? null : toOverdueList(data as unknown as OverdueJobRow[], count);
  } catch {
    return null;
  }
}
