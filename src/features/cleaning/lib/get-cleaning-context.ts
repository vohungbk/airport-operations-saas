import { createClient } from "@/lib/supabase/server";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";
import type { SeatStatus } from "@/features/seats/types";

export interface CleaningRecord {
  id: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  seat_serial_number: string | null;
  recorded_by: string | null;
}

export interface CleaningContext {
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
      status: SeatStatus;
      category_name: string | null;
    } | null;
  };
  /** The recorded cleaning, when there is one. */
  cleaning: CleaningRecord | null;
}

/**
 * Explicit column list: what the cleaning screen needs, no pricing or
 * partner data. RLS limits the row: a technician only gets their own job.
 */
const CLEANING_CONTEXT_SELECT = [
  "id",
  "status",
  "job_type",
  "technician_id",
  "booking:bookings!inner(booking_number, airport:airports!inner(code, name, timezone), seat:seats!assigned_seat_id(id, serial_number, status, category:seat_categories(name)))",
  "cleaning:cleaning_records(id, completed_at, notes, created_at, seat:seats(serial_number), recorder:users!employee_id(full_name))",
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
      status: SeatStatus;
      category: { name: string } | null;
    } | null;
  };
  cleaning: CleaningRow | CleaningRow[] | null;
}

interface CleaningRow {
  id: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  seat: { serial_number: string } | null;
  recorder: { full_name: string } | null;
}

/**
 * Server-only. `null` for a malformed id, an unknown id, or a job RLS hides
 * (another technician's): the caller turns that into the forbidden state.
 */
export async function getCleaningContext(
  jobId: string,
): Promise<CleaningContext | null> {
  if (!jobIdSchema.safeParse(jobId).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(CLEANING_CONTEXT_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as Row;
  // One cleaning per job: PostgREST returns an object or a 1-item array.
  const cleaning = Array.isArray(row.cleaning)
    ? (row.cleaning[0] ?? null)
    : row.cleaning;

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
        status: row.booking.seat.status,
        category_name: row.booking.seat.category?.name ?? null,
      },
    },
    cleaning: cleaning && {
      id: cleaning.id,
      completed_at: cleaning.completed_at,
      notes: cleaning.notes,
      created_at: cleaning.created_at,
      seat_serial_number: cleaning.seat?.serial_number ?? null,
      recorded_by: cleaning.recorder?.full_name ?? null,
    },
  };
}
