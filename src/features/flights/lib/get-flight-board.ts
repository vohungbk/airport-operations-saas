import { createClient } from "@/lib/supabase/server";
import { zonedDayStartToUtcIso } from "@/features/bookings/lib/booking-time";
import { ACTIVE_BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";
import {
  FLIGHT_BOARD_LIMIT,
  buildFlightBoardAlerts,
  buildFlightBoardRows,
  formatZoneHeader,
  getTodayInZone,
  type BoardFlightInput,
  type FlightBoardAlert,
  type FlightBoardRow,
} from "@/features/flights/lib/flight-board";
import { formatDate, formatTime, zoneLabel } from "@/features/jobs/lib/job-time";
import { getFlightSourceConfig } from "@/features/flights/lib/provider/provider-config";
import { FLIGHT_SOURCE_LABELS } from "@/features/flights/lib/provider-status-labels";
import type { FlightBoardQuery } from "@/features/flights/schemas/flight-board-query.schema";

export interface FlightBoardAirport {
  id: string;
  code: string;
  name: string;
  timezone: string;
}

export interface FlightBoard {
  /** The airports of the select; RLS decides which are visible. */
  airports: { value: string; label: string }[];
  /** The airport shown; null when the viewer sees none. */
  airport: FlightBoardAirport | null;
  /** `DXB · Dubai International · 24 Oct 2026 · Asia/Dubai (GST, UTC+4)`; null without an airport. */
  heading: string | null;
  rows: FlightBoardRow[];
  alerts: FlightBoardAlert[];
  /** `Live provider`, `Sandbox` or `Simulator`; null when the configuration is not valid. */
  source_label: string | null;
  /** `Last sync 14:02 GST`, or `Never synced`. */
  last_sync_label: string;
  /** True when more flights matched than the board reads. */
  truncated: boolean;
}

/** The select is a runtime string, like the alerts query, so the nested relations are cast below. */
const FLIGHT_BOARD_SELECT =
  "id, flight_number, status, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes, last_synced_at, bookings!inner(id, booking_number, pickup_at, technician_jobs(deadline_at, status, job_type))";

function getSourceLabel(): string | null {
  try {
    return FLIGHT_SOURCE_LABELS[getFlightSourceConfig().source];
  } catch {
    // A wrong configuration is shown on the provider settings; it does not hide the board.
    return null;
  }
}

function getLastSyncLabel(flights: readonly BoardFlightInput[], timeZone: string): string {
  const times = flights
    .map((flight) => (flight.last_synced_at ? Date.parse(flight.last_synced_at) : Number.NaN))
    .filter((time) => !Number.isNaN(time));

  if (times.length === 0) return "Never synced";

  const latest = new Date(Math.max(...times)).toISOString();

  return `Last sync ${formatTime(latest, timeZone)} ${zoneLabel(timeZone)}`;
}

/**
 * Server-only. The flights of the chosen airport from the start of today at that airport, with one
 * row for each linked booking that is still active. RLS is the access boundary: it decides which flights and bookings the
 * viewer sees. A failed read throws, so the page shows its error state and never an empty board.
 */
export async function getFlightBoard(query: FlightBoardQuery, now: Date = new Date()): Promise<FlightBoard> {
  const supabase = await createClient();

  const airportsResult = await supabase
    .from("airports")
    .select("id, code, name, timezone")
    .order("code", { ascending: true });

  if (airportsResult.error) throw airportsResult.error;

  const airports = airportsResult.data ?? [];
  const airport = airports.find((item) => item.id === query.airport_id) ?? airports[0] ?? null;
  const source_label = getSourceLabel();
  const options = airports.map((item) => ({ value: item.id, label: item.code }));

  if (!airport) {
    return {
      airports: options,
      airport: null,
      heading: null,
      rows: [],
      alerts: [],
      source_label,
      last_sync_label: "Never synced",
      truncated: false,
    };
  }

  const dayStart = zonedDayStartToUtcIso(getTodayInZone(now, airport.timezone), airport.timezone);

  if (!dayStart) throw new Error("Could not work out the start of today at the airport");

  let request = supabase
    .from("flights")
    .select(FLIGHT_BOARD_SELECT)
    .eq("airport_id", airport.id)
    .gte("scheduled_arrival_at", dayStart)
    // Only bookings still in operation: a cancelled or finished booking needs no attention.
    .in("bookings.status", [...ACTIVE_BOOKING_STATUSES]);

  if (query.status) request = request.eq("status", query.status);

  const { data, error } = await request
    .order("scheduled_arrival_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(FLIGHT_BOARD_LIMIT);

  if (error) throw error;

  const flights = (data ?? []) as unknown as BoardFlightInput[];
  const rows = buildFlightBoardRows(flights, airport.timezone, now);

  return {
    airports: options,
    airport,
    heading: `${airport.code} · ${airport.name} · ${formatDate(now, airport.timezone)} · ${formatZoneHeader(airport.timezone, now)}`,
    rows,
    alerts: buildFlightBoardAlerts(rows, airport.timezone),
    source_label,
    last_sync_label: getLastSyncLabel(flights, airport.timezone),
    truncated: flights.length >= FLIGHT_BOARD_LIMIT,
  };
}
