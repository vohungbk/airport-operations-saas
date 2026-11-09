import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";
import type { TechnicianActivity } from "@/features/technicians/types";

/** Newest jobs shown on the detail page; the design has no pagination. */
export const TECHNICIAN_JOBS_LIMIT = 50;

const JOB_SELECT =
  "id, job_number, job_type, status, updated_at, booking:bookings!inner(booking_number, airport:airports(name, code, timezone), seat:seats!assigned_seat_id(serial_number))";

interface JobRow {
  id: string;
  job_number: string;
  job_type: JobType;
  status: JobStatus;
  updated_at: string;
  booking: {
    booking_number: string;
    airport: { name: string; code: string; timezone: string } | null;
    seat: { serial_number: string } | null;
  } | null;
}

/** Row of `technician_list_figures`; the server client is untyped, so it is typed here. */
interface FiguresRow {
  open_jobs: number;
  jobs_done_this_week: number;
}

/**
 * Server-only. The two figures come from the same function as the list, so the
 * list and the detail always agree. The airport is the one of the most
 * recently assigned job (a technician has no airport of their own), as in the
 * list. RLS is the scope of every read.
 */
export async function getTechnicianActivity(
  technician_id: string,
): Promise<TechnicianActivity> {
  const supabase = await createClient();

  const [jobsResult, figuresResult] = await Promise.all([
    supabase
      .from("technician_jobs")
      .select(JOB_SELECT)
      .eq("technician_id", technician_id)
      .order("assigned_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(TECHNICIAN_JOBS_LIMIT),
    supabase.rpc("technician_list_figures", {
      p_technician_ids: [technician_id],
    }),
  ]);

  if (jobsResult.error) {
    throw jobsResult.error;
  }

  if (figuresResult.error) {
    throw figuresResult.error;
  }

  const rows = (jobsResult.data ?? []) as unknown as JobRow[];
  const figures = ((figuresResult.data ?? []) as FiguresRow[])[0];
  const airport = rows[0]?.booking?.airport ?? null;

  return {
    airport,
    open_jobs: figures?.open_jobs ?? 0,
    jobs_done_this_week: figures?.jobs_done_this_week ?? 0,
    jobs: rows.map((row) => ({
      id: row.id,
      job_number: row.job_number,
      job_type: row.job_type,
      status: row.status,
      updated_at: row.updated_at,
      booking_number: row.booking?.booking_number ?? null,
      seat_serial_number: row.booking?.seat?.serial_number ?? null,
      timezone: row.booking?.airport?.timezone ?? "UTC",
    })),
  };
}
