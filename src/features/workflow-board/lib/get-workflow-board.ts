import { createClient } from "@/lib/supabase/server";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { buildOverdueLabel } from "@/features/bookings/lib/booking-deadlines";
import { formatPickup, zonedDayStartToUtcIso } from "@/features/bookings/lib/booking-time";
import { getAirportTimezone } from "@/features/bookings/lib/get-airport-timezone";
import type { BookingStatus } from "@/features/bookings/types";
import type { SeatStatus } from "@/features/seats/types";
import { escapeIlikeValue } from "@/features/seat-categories/lib/escape-ilike";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import {
  buildFlightAlertMark,
  buildTimeInStepLabel,
  type FlightAlertMark,
} from "@/features/workflow-board/lib/board-card";
import type { FlightTimes } from "@/lib/flights/flight-timing";
import { BOOKING_BOARD_STEPS, type BoardPriority } from "@/lib/workflow/board";

/** How many cards a column shows; the rest is counted as "+N more". */
export const BOARD_COLUMN_CARD_LIMIT = 10;

export interface BoardCardItem {
  id: string;
  booking_number: string;
  /** The step the booking is at; the card offers the move to the one after it. */
  status: BookingStatus;
  /** "Partner · flight · airport" for the move dialog; the parts that are known. */
  summary: string;
  /** The status of the assigned seat (it decides whether the move is ready); `null` when none. */
  seat_status: SeatStatus | null;
  partner_name: string | null;
  flight_number: string | null;
  /** "SEAT-0001 · Convertible", or the part that is known; `null` when no seat is assigned. */
  seat_label: string | null;
  /** The pickup time in the timezone of the airport, with the airport code. */
  pickup_label: string;
  priority: BoardPriority;
  /** Set only when the flight is early or delayed past the alert threshold. */
  flight_alert: FlightAlertMark | null;
  /** "Overdue by 20 min" once the deadline of the next step has passed (CO-F08-S07). */
  overdue_label: string | null;
  /** "In step 2 h 10 min"; `null` when no event says when the step began. */
  time_in_step_label: string | null;
}

export interface BoardColumn {
  status: BookingStatus;
  label: string;
  /** Every booking in this step for the filters, not only the cards shown. */
  total: number;
  cards: BoardCardItem[];
}

export interface WorkflowBoard {
  columns: BoardColumn[];
  /** Bookings in view, across all columns. */
  total: number;
  /** The timezone of the airport when the board is read for one day at one airport; else `null`. */
  time_zone: string | null;
}

interface BoardRow {
  id: string;
  booking_number: string;
  status: BookingStatus;
  pickup_at: string;
  partner: { name: string } | null;
  airport: { code: string; timezone: string } | null;
  seat: { serial_number: string; status: SeatStatus } | null;
  category: { name: string } | null;
  flight: (FlightTimes & { flight_number: string }) | null;
  /** Computed column `board_priority` (see 20261123090000_workflow_board_reads.sql). */
  priority: string | null;
  /** Computed column `board_step_since`. */
  step_since: string | null;
}

const PRIORITIES: readonly string[] = ["normal", "high", "urgent"];

const BOARD_SELECT =
  "id, booking_number, status, pickup_at, partner:partners(name), airport:airports(code, timezone), seat:seats(serial_number, status), category:seat_categories(name), flight:flights(flight_number, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, delay_minutes), priority:board_priority, step_since:board_step_since";

function toCard(row: BoardRow, now: Date, withDate: boolean): BoardCardItem {
  const seatParts = [row.seat?.serial_number, row.category?.name].filter(Boolean);

  return {
    id: row.id,
    booking_number: row.booking_number,
    status: row.status,
    summary: [row.partner?.name, row.flight?.flight_number, row.airport?.code].filter(Boolean).join(" · "),
    seat_status: row.seat?.status ?? null,
    partner_name: row.partner?.name ?? null,
    flight_number: row.flight?.flight_number ?? null,
    seat_label: seatParts.length > 0 ? seatParts.join(" · ") : null,
    pickup_label: row.airport
      ? `${formatPickup(row.pickup_at, row.airport.timezone, withDate)} · ${row.airport.code}`
      : formatPickup(row.pickup_at, "UTC", withDate),
    priority: PRIORITIES.includes(row.priority ?? "") ? (row.priority as BoardPriority) : "normal",
    flight_alert: buildFlightAlertMark(row.flight),
    overdue_label: buildOverdueLabel(row.status, row.pickup_at, now),
    time_in_step_label: buildTimeInStepLabel(row.step_since, now),
  };
}

/**
 * Server-only. One query per step (five, whatever the number of bookings), each with an exact count and
 * a card limit, so a column says how many bookings it holds without loading them all. RLS is the
 * access boundary; the filters here only narrow what the person asked for. `cancelled` and `no_show`
 * are not steps of the path, so they have no column.
 */
export async function getWorkflowBoard(query: WorkflowBoardQuery): Promise<WorkflowBoard> {
  const supabase = await createClient();

  // A day is a calendar day at the selected airport; without an airport it is read in UTC.
  let timeZone = "UTC";

  if (query.airport_id && query.date) {
    const airport = await getAirportTimezone(supabase, query.airport_id);

    if (airport.error) {
      throw airport.error;
    }

    timeZone = airport.timezone ?? "UTC";
  }

  const pickupFrom = query.date ? zonedDayStartToUtcIso(query.date, timeZone) : null;
  const pickupBefore = query.date ? zonedDayStartToUtcIso(query.date, timeZone, 1) : null;

  const now = new Date();

  const columns = await Promise.all(
    BOOKING_BOARD_STEPS.map(async (status): Promise<BoardColumn> => {
      let request = supabase
        .from("bookings")
        .select(BOARD_SELECT, { count: "exact" })
        .eq("status", status);

      if (query.partner_id) request = request.eq("partner_id", query.partner_id);
      if (query.airport_id) request = request.eq("airport_id", query.airport_id);
      if (query.flight_alert) request = request.eq("board_flight_alert", query.flight_alert);
      if (query.priority) request = request.eq("board_priority", query.priority);
      if (query.q) request = request.ilike("booking_number", `%${escapeIlikeValue(query.q)}%`);
      if (pickupFrom) request = request.gte("pickup_at", pickupFrom);
      if (pickupBefore) request = request.lt("pickup_at", pickupBefore);

      const { data, count, error } = await request
        .order("pickup_at", { ascending: true })
        // Unique tie-breaker so ties on pickup time keep one order.
        .order("id", { ascending: true })
        .limit(BOARD_COLUMN_CARD_LIMIT);

      if (error) {
        throw error;
      }

      return {
        status,
        label: BOOKING_STATUS_LABEL[status],
        total: count ?? 0,
        cards: ((data ?? []) as unknown as BoardRow[]).map((row) => toCard(row, now, !query.date)),
      };
    }),
  );

  return {
    columns,
    total: columns.reduce((sum, column) => sum + column.total, 0),
    time_zone: query.airport_id && query.date ? timeZone : null,
  };
}
