import {
  DISRUPTION_ACTION,
  classifyFlight,
  formatAge,
  getDataAgeMinutes,
  getDisruptionTitle,
  getFlightOffsetMinutes,
  isStale,
} from "@/lib/flights/flight-timing";
import {
  getInstallationDeadline,
  isDeadlineMoved,
  isFlightLanded,
  type DeadlineJob,
} from "@/features/flights/lib/flight-panel";
import { formatDayMonth, formatTime, zoneLabel } from "@/features/jobs/lib/job-time";

/**
 * Pure rules of the Flight board (VI-F02-S08): which change, priority, deadline and stale tag a row
 * shows, and the alerts above the table. No I/O. Nothing is made up: a value that is not stored is
 * shown as a dash.
 */

/** At most this many flights are read; the board says so when the list is cut. */
export const FLIGHT_BOARD_LIMIT = 100;

export interface BoardBookingInput {
  id: string;
  booking_number: string;
  pickup_at: string;
  technician_jobs: DeadlineJob[] | null;
}

export interface BoardFlightInput {
  id: string;
  flight_number: string;
  status: string;
  scheduled_arrival_at: string;
  estimated_arrival_at: string | null;
  actual_arrival_at: string | null;
  delay_minutes: number | null;
  last_synced_at: string | null;
  bookings: BoardBookingInput[] | null;
}

export type FlightChangeKind = "early" | "delayed" | "on_time" | "cancelled" | "diverted" | "unknown";

export interface FlightChange {
  kind: FlightChangeKind;
  /** Always positive; null unless the flight is early or late. */
  minutes: number | null;
  label: string;
}

export type FlightPriority = "high" | "normal";

/** A time as the design writes it: the day above and the time with the zone below, in the airport zone. */
export interface BoardTime {
  date: string;
  time: string;
}

export interface FlightBoardRow {
  key: string;
  booking_id: string;
  booking_number: string;
  flight_number: string;
  status: string;
  scheduled: BoardTime;
  estimated: BoardTime | null;
  change: FlightChange;
  priority: FlightPriority;
  deadline: BoardTime | null;
  /** True when the stored deadline is not the base one (pickup minus 60 minutes). */
  deadline_moved: boolean;
  /** `Stale · 25 min` when the data is old and the flight is still refreshed; otherwise null. */
  stale_label: string | null;
}

export interface FlightBoardAlert {
  key: string;
  kind: "early" | "delayed" | "cancelled" | "diverted";
  title: string;
  detail: string;
}

/** Early or late by the gap between the expected and the scheduled arrival; cancelled and diverted say so. */
export function getFlightChange(
  flight: Pick<
    BoardFlightInput,
    "status" | "scheduled_arrival_at" | "estimated_arrival_at" | "actual_arrival_at" | "delay_minutes"
  >,
): FlightChange {
  if (flight.status === "cancelled") return { kind: "cancelled", minutes: null, label: "Cancelled" };
  if (flight.status === "diverted") return { kind: "diverted", minutes: null, label: "Diverted" };

  const offset = getFlightOffsetMinutes(flight);
  const timing = classifyFlight(offset);

  if (offset === null || timing === "unknown") return { kind: "unknown", minutes: null, label: "-" };

  const minutes = Math.abs(offset);

  if (timing === "early") return { kind: "early", minutes, label: `Early ${minutes} min` };
  if (timing === "delayed") return { kind: "delayed", minutes, label: `Delayed ${minutes} min` };

  return { kind: "on_time", minutes: null, label: "On time" };
}

/** Two levels (spec Q5): High when the flight is 15 minutes or more early, Normal otherwise. */
export function getFlightPriority(change: FlightChange): FlightPriority {
  return change.kind === "early" ? "high" : "normal";
}

/** `Stale · 25 min`, or null. A landed or cancelled flight is no longer refreshed, so its data is final. */
export function getStaleLabel(flight: Pick<BoardFlightInput, "status" | "last_synced_at">, now: Date): string | null {
  if (isFlightLanded(flight.status) || flight.status === "cancelled") return null;

  const age = getDataAgeMinutes(flight.last_synced_at, now);

  return isStale(age) ? `Stale · ${formatAge(age).replace(" ago", "")}` : null;
}

function toBoardTime(iso: string, timeZone: string): BoardTime {
  return { date: formatDayMonth(iso, timeZone), time: `${formatTime(iso, timeZone)} ${zoneLabel(timeZone)}` };
}

/** One row for each booking linked to a flight, in the order of the flights. */
export function buildFlightBoardRows(
  flights: readonly BoardFlightInput[],
  timeZone: string,
  now: Date,
): FlightBoardRow[] {
  return flights.flatMap((flight) => {
    const change = getFlightChange(flight);
    const expected = flight.estimated_arrival_at ?? flight.actual_arrival_at;
    const stale_label = getStaleLabel(flight, now);

    return (flight.bookings ?? []).map((booking) => {
      const deadlineAt = getInstallationDeadline(booking.technician_jobs);

      return {
        key: `${flight.id}:${booking.id}`,
        booking_id: booking.id,
        booking_number: booking.booking_number,
        flight_number: flight.flight_number,
        status: flight.status,
        scheduled: toBoardTime(flight.scheduled_arrival_at, timeZone),
        estimated: expected ? toBoardTime(expected, timeZone) : null,
        change,
        priority: getFlightPriority(change),
        deadline: deadlineAt ? toBoardTime(deadlineAt, timeZone) : null,
        deadline_moved: isDeadlineMoved(deadlineAt, booking.pickup_at),
        stale_label,
      };
    });
  });
}

function unit(minutes: number): string {
  return minutes === 1 ? "MINUTE" : "MINUTES";
}

function toAlert(row: FlightBoardRow, kind: "early" | "delayed", timeZone: string): FlightBoardAlert {
  const minutes = row.change.minutes ?? 0;
  const title =
    kind === "early"
      ? `ARRIVING ${minutes} ${unit(minutes)} EARLY`
      : `DELAYED ${minutes} ${unit(minutes)}${row.deadline_moved ? ", DEADLINE MOVED" : ""}`;
  const parts = [row.flight_number];

  if (row.estimated) parts.push(`Estimated ${row.estimated.time}`);
  if (row.deadline_moved && row.deadline) parts.push(`Installation deadline moved to ${row.deadline.time}`);
  parts.push(timeZone);

  return { key: row.key, kind, title, detail: `${parts.join(" · ")}.` };
}

function toDisruptionAlert(row: FlightBoardRow, kind: "cancelled" | "diverted"): FlightBoardAlert {
  return {
    key: row.key,
    kind,
    title: getDisruptionTitle(kind),
    detail: `${row.flight_number} · ${row.booking_number} · ${DISRUPTION_ACTION}`,
  };
}

/**
 * The banners above the table: a flag for each cancelled and diverted flight (the first of each, VI-F02-S06),
 * then the first early flight and the first late flight of the rows. Only
 * what is stored is written (who was notified is not stored, so it is not said).
 */
export function buildFlightBoardAlerts(rows: readonly FlightBoardRow[], timeZone: string): FlightBoardAlert[] {
  const early = rows.find((row) => row.change.kind === "early");
  const delayed = rows.find((row) => row.change.kind === "delayed");

  const cancelled = rows.find((row) => row.change.kind === "cancelled");
  const diverted = rows.find((row) => row.change.kind === "diverted");

  return [
    ...(cancelled ? [toDisruptionAlert(cancelled, "cancelled")] : []),
    ...(diverted ? [toDisruptionAlert(diverted, "diverted")] : []),
    ...(early ? [toAlert(early, "early", timeZone)] : []),
    ...(delayed ? [toAlert(delayed, "delayed", timeZone)] : []),
  ];
}

/** Today's calendar day (`YYYY-MM-DD`) at the airport. */
export function getTodayInZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** `Asia/Dubai (GST, UTC+4)`; a half-hour zone is `UTC+5:30`. */
export function formatZoneHeader(timeZone: string, now: Date): string {
  const offset =
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(offset);
  const sign = match?.[1] ?? "+";
  const hours = Number(match?.[2] ?? 0);
  const minutes = match?.[3] && match[3] !== "00" ? `:${match[3]}` : "";

  return `${timeZone} (${zoneLabel(timeZone)}, UTC${sign}${hours}${minutes})`;
}
