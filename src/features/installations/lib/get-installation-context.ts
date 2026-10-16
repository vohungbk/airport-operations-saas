import { createClient } from "@/lib/supabase/server";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";

export interface InstallationRecord {
  id: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  seat_serial_number: string | null;
  recorded_by: string | null;
}

export interface InstallationContext {
  job: {
    id: string;
    status: JobStatus;
    job_type: JobType;
    technician_id: string;
  };
  booking: {
    booking_number: string;
    airport: { code: string; name: string; timezone: string };
    seat: {
      id: string;
      serial_number: string;
      category_name: string | null;
    } | null;
  };
  /** The recorded installation, when there is one. */
  installation: InstallationRecord | null;
}

/**
 * Explicit column list: what the installation screen needs, no pricing or
 * partner data. RLS limits the row: a technician only gets their own job.
 */
const INSTALLATION_CONTEXT_SELECT = [
  "id",
  "status",
  "job_type",
  "technician_id",
  "booking:bookings!inner(booking_number, airport:airports!inner(code, name, timezone), seat:seats!assigned_seat_id(id, serial_number, category:seat_categories(name)))",
  "installation:installations(id, completed_at, notes, created_at, seat:seats(serial_number), recorder:users!created_by(full_name))",
].join(", ");

interface Row {
  id: string;
  status: JobStatus;
  job_type: JobType;
  technician_id: string;
  booking: {
    booking_number: string;
    airport: { code: string; name: string; timezone: string };
    seat: {
      id: string;
      serial_number: string;
      category: { name: string } | null;
    } | null;
  };
  installation: InstallationRow | InstallationRow[] | null;
}

interface InstallationRow {
  id: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  seat: { serial_number: string } | null;
  recorder: { full_name: string } | null;
}

/**
 * Server-only. `null` for a malformed id, an unknown id, or a job RLS hides
 * (another technician's): the caller turns that into `notFound()`.
 */
export async function getInstallationContext(
  jobId: string,
): Promise<InstallationContext | null> {
  if (!jobIdSchema.safeParse(jobId).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(INSTALLATION_CONTEXT_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as Row;
  // One installation per job: PostgREST returns an object or a 1-item array.
  const installation = Array.isArray(row.installation)
    ? (row.installation[0] ?? null)
    : row.installation;

  return {
    job: {
      id: row.id,
      status: row.status,
      job_type: row.job_type,
      technician_id: row.technician_id,
    },
    booking: {
      booking_number: row.booking.booking_number,
      airport: row.booking.airport,
      seat: row.booking.seat && {
        id: row.booking.seat.id,
        serial_number: row.booking.seat.serial_number,
        category_name: row.booking.seat.category?.name ?? null,
      },
    },
    installation: installation && {
      id: installation.id,
      completed_at: installation.completed_at,
      notes: installation.notes,
      created_at: installation.created_at,
      seat_serial_number: installation.seat?.serial_number ?? null,
      recorded_by: installation.recorder?.full_name ?? null,
    },
  };
}
