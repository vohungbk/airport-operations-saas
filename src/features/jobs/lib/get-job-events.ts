import { createClient } from "@/lib/supabase/server";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobEventItem } from "@/features/jobs/types";

export const JOB_EVENTS_LIMIT = 50;

const JOB_EVENT_SELECT = [
  "id",
  "from_status",
  "to_status",
  "from_technician_id",
  "to_technician_id",
  "notes",
  "created_at",
  "actor:users!user_id(full_name)",
  "from_technician:users!from_technician_id(full_name)",
  "to_technician:users!to_technician_id(full_name)",
].join(", ");

export interface JobEventsResult {
  events: JobEventItem[];
  /** True when older events were cut off by the limit. */
  truncated: boolean;
}

interface EventRow {
  id: string;
  from_status: JobEventItem["from_status"];
  to_status: JobEventItem["to_status"];
  from_technician_id: string | null;
  to_technician_id: string | null;
  notes: string | null;
  created_at: string;
  actor: { full_name: string } | null;
  from_technician: { full_name: string } | null;
  to_technician: { full_name: string } | null;
}

/**
 * Server-only, read-only, newest first. Fetches one extra row to know
 * whether older events were cut off. The log is append-only in the DB and
 * RLS scopes it: a technician only gets events of their own jobs. Names a
 * user is not allowed to read come back null and the UI falls back.
 */
export async function getJobEvents(jobId: string): Promise<JobEventsResult> {
  if (!jobIdSchema.safeParse(jobId).success) {
    return { events: [], truncated: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_job_events")
    .select(JOB_EVENT_SELECT)
    .eq("technician_job_id", jobId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(JOB_EVENTS_LIMIT + 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as EventRow[];

  const events = rows.slice(0, JOB_EVENTS_LIMIT).map((row) => ({
    id: row.id,
    from_status: row.from_status,
    to_status: row.to_status,
    status_changed: row.from_status !== row.to_status,
    technician_changed: row.from_technician_id !== row.to_technician_id,
    from_technician_name: row.from_technician?.full_name ?? null,
    to_technician_name: row.to_technician?.full_name ?? null,
    notes: row.notes,
    created_at: row.created_at,
    actor_name: row.actor?.full_name ?? null,
  }));

  return { events, truncated: rows.length > JOB_EVENTS_LIMIT };
}
