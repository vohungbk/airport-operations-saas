import {
  classifyFlight,
  getFlightOffsetMinutes,
  type FlightTimes,
  type FlightTiming,
} from "@/lib/flights/flight-timing";
import type { JobStatus } from "@/features/jobs/lib/job-status";
import type { JobType } from "@/features/jobs/lib/job-type";

/**
 * Pure logic for Today's Jobs (UI-F07-S01, spec R1, E3). The list is ordered by deadline (a job with
 * none last), then by the pickup time of its booking. "Today" is the UTC day, as on the dashboard.
 */

/** The statuses of a job that is still to be done. */
export const OPEN_JOB_STATUSES = [
  "assigned",
  "in_progress",
] as const satisfies readonly JobStatus[];

/** One job as the read returns it, before it is picked for today. */
export interface TodayJobRow {
  id: string;
  job_number: string;
  deadline_at: string | null;
  status: JobStatus;
  job_type: JobType;
  vehicle_bay: string | null;
  technician: { full_name: string } | null;
  booking: {
    booking_number: string;
    pickup_at: string;
    vehicle: string | null;
    vehicle_bay: string | null;
    airport: {
      code: string;
      name: string;
      city: string;
      timezone: string;
    } | null;
    required_category: { name: string } | null;
    seat: { serial_number: string } | null;
    flight:
      | (FlightTimes & {
          flight_number: string;
          terminal: string | null;
          last_synced_at: string | null;
        })
      | null;
  } | null;
}

/** One job of Today's Jobs, with what the screen writes about it. */
export interface TodayJob {
  id: string;
  job_number: string;
  /** When the job has to be done; null while none is stored. */
  deadline_at: string | null;
  status: JobStatus;
  job_type: JobType;
  /** The pickup time of the booking: it orders the list and is the time of the next job in the empty state. */
  pickup_at: string;
  booking_number: string;
  /** The display name of the partner; only a technician's own job has it (VI-F11-T02). Set by the read, never by `selectTodaysJobs`. */
  partner_name?: string | null;
  technician: string | null;
  vehicle: string | null;
  vehicle_bay: string | null;
  airport: { code: string; city: string; timezone: string } | null;
  required_category: string | null;
  seat: string | null;
  flight: {
    flight_number: string;
    terminal: string | null;
    timing: FlightTiming;
    /** Minutes early (negative) or late (positive); null when it cannot be told. */
    offset_minutes: number | null;
    scheduled_at: string;
    /** The actual arrival, or the estimate when it has not landed. */
    expected_at: string | null;
    last_synced_at: string | null;
  } | null;
}

export interface TodaysJobs {
  jobs: TodayJob[];
  /** The pickup time of the first open job after today, for the empty state; null when there is none. */
  next_pickup_at: string | null;
}

const DAY_MS = 86_400_000;

/** The first instant after the UTC day of `now`. */
export function endOfUtcDay(now: Date): number {
  return Math.floor(now.getTime() / DAY_MS) * DAY_MS + DAY_MS;
}

type Ordered = { pickup_at: string; id: string };
type OrderedByDeadline = Ordered & { deadline_at: string | null };

const byPickup = (a: Ordered, b: Ordered) =>
  Date.parse(a.pickup_at) - Date.parse(b.pickup_at) || a.id.localeCompare(b.id);

/** The earliest deadline first, a job with no deadline last, then by pickup and id. */
const byDeadline = (a: OrderedByDeadline, b: OrderedByDeadline) => {
  const left = a.deadline_at === null ? Infinity : Date.parse(a.deadline_at);
  const right = b.deadline_at === null ? Infinity : Date.parse(b.deadline_at);

  return left === right ? byPickup(a, b) : left < right ? -1 : 1;
};

/** The job as the screen writes it, from its row and its booking; the one place a row becomes a `TodayJob`. */
export function toTodayJob(
  row: TodayJobRow,
  booking: NonNullable<TodayJobRow["booking"]>,
): TodayJob {
  const { flight, seat } = booking;
  const offset = flight ? getFlightOffsetMinutes(flight) : null;

  return {
    id: row.id,
    job_number: row.job_number,
    deadline_at: row.deadline_at,
    status: row.status,
    job_type: row.job_type,
    pickup_at: booking.pickup_at,
    booking_number: booking.booking_number,
    technician: row.technician?.full_name ?? null,
    vehicle: booking.vehicle,
    vehicle_bay: row.vehicle_bay ?? booking.vehicle_bay,
    airport: booking.airport && {
      code: booking.airport.code,
      city: booking.airport.city,
      timezone: booking.airport.timezone,
    },
    required_category: booking.required_category?.name ?? null,
    seat: seat?.serial_number ?? null,
    flight: flight && {
      flight_number: flight.flight_number,
      terminal: flight.terminal,
      timing: classifyFlight(offset),
      offset_minutes: offset,
      scheduled_at: flight.scheduled_arrival_at,
      expected_at: flight.actual_arrival_at ?? flight.estimated_arrival_at,
      last_synced_at: flight.last_synced_at,
    },
  };
}

/**
 * The open jobs whose pickup is today or earlier, and every job in progress, the earliest deadline first, and the
 * pickup of the first open job after today. A job of another status, or one with no booking, is not listed.
 */
export function selectTodaysJobs(rows: readonly TodayJobRow[], now: Date): TodaysJobs {
  const endOfToday = endOfUtcDay(now);
  const open = rows.flatMap((row) =>
    row.booking && (OPEN_JOB_STATUSES as readonly JobStatus[]).includes(row.status)
      ? [{ id: row.id, row, booking: row.booking, pickup_at: row.booking.pickup_at, deadline_at: row.deadline_at }]
      : [],
  );

  const jobs = open
    // A job that is in progress stays on the list, whatever its pickup: it is being done now.
    .filter(({ row, pickup_at }) => row.status === "in_progress" || Date.parse(pickup_at) < endOfToday)
    .sort(byDeadline)
    .map(({ row, booking }) => toTodayJob(row, booking));

  const later = open
    .filter(({ row, pickup_at }) => row.status !== "in_progress" && Date.parse(pickup_at) >= endOfToday)
    .sort(byPickup);

  return { jobs, next_pickup_at: later[0]?.pickup_at ?? null };
}

/** The job the Scan item of the menu opens: the first of the day whose work starts with a seat scan, an installation. */
export function pickJobToScan(jobs: readonly TodayJob[]): TodayJob | undefined {
  return jobs.find((job) => job.job_type === "installation");
}

/** The job after this one: the first job of the day that is not it (a job in progress included). */
export function pickNextJob(jobs: readonly TodayJob[], currentJobId: string): TodayJob | undefined {
  return jobs.find((job) => job.id !== currentJobId);
}
