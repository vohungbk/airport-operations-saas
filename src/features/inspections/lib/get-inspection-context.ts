import { createClient } from "@/lib/supabase/server";
import { jobIdSchema } from "@/features/jobs/schemas/jobs-query.schema";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";
import type { SeatStatus } from "@/features/seats/types";
import type { InspectionResult } from "@/features/inspections/schemas/record-inspection.schema";
import {
  toInspectionFollowUp,
  type InspectionFollowUp,
} from "@/features/inspections/lib/inspection-follow-up";

export interface InspectionRecord {
  id: string;
  result: InspectionResult;
  notes: string | null;
  created_at: string;
  follow_up: InspectionFollowUp | null;
  seat_serial_number: string | null;
  recorded_by: string | null;
}

export interface InspectionContext {
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
  /** The recorded inspection, when there is one. */
  inspection: InspectionRecord | null;
}

/**
 * Explicit column list: what the inspection screen needs, no pricing or
 * partner data. RLS limits the row: a technician only gets their own job.
 */
const INSPECTION_CONTEXT_SELECT = [
  "id",
  "status",
  "job_type",
  "technician_id",
  "booking:bookings!inner(booking_number, airport:airports!inner(code, name, timezone), seat:seats!assigned_seat_id(id, serial_number, status, category:seat_categories(name)))",
  "inspection:inspection_records(id, result, notes, created_at, follow_up, seat:seats(serial_number), recorder:users!inspector_id(full_name))",
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
  inspection: InspectionRow | InspectionRow[] | null;
}

interface InspectionRow {
  id: string;
  result: InspectionResult;
  notes: string | null;
  created_at: string;
  follow_up: string | null;
  seat: { serial_number: string } | null;
  recorder: { full_name: string } | null;
}

/**
 * Server-only. `null` for a malformed id, an unknown id, or a job RLS hides
 * (another technician's): the caller turns that into the forbidden state.
 */
export async function getInspectionContext(
  jobId: string,
): Promise<InspectionContext | null> {
  if (!jobIdSchema.safeParse(jobId).success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_jobs")
    .select(INSPECTION_CONTEXT_SELECT)
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as Row;
  // One inspection per job: PostgREST returns an object or a 1-item array.
  const inspection = Array.isArray(row.inspection)
    ? (row.inspection[0] ?? null)
    : row.inspection;

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
    inspection: inspection && {
      id: inspection.id,
      result: inspection.result,
      notes: inspection.notes,
      created_at: inspection.created_at,
      follow_up: toInspectionFollowUp(inspection.follow_up),
      seat_serial_number: inspection.seat?.serial_number ?? null,
      recorded_by: inspection.recorder?.full_name ?? null,
    },
  };
}
