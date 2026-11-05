import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/database.types";

import { diffFlight, toHistorySource } from "./flight-diff";
import { getFlightSource } from "./provider/get-flight-source";
import type { FlightSourceAdapter } from "./provider/flight-source";
import { isRefreshDue } from "./refresh-schedule";

/** A flight that is linked to a booking, with what the schedule and the history need. */
const CANDIDATE_SELECT =
  "id, flight_number, status, scheduled_arrival_at, estimated_arrival_at, actual_arrival_at, terminal, delay_minutes, last_synced_at, bookings!inner(id)";

/** A booking in one of these statuses no longer needs its flight, so it does not keep the flight refreshed. */
const ENDED_BOOKING_STATUSES = "(completed,cancelled,no_show)";

/** How many flights are asked from the source at the same time. */
const CONCURRENCY = 5;

/** What one run did. `failed` flights keep their last data (spec R12). */
export interface RefreshSummary {
  /** The linked flights that were due. */
  checked: number;
  /** Asked from the source and stored; `changed` of them had something new. */
  refreshed: number;
  changed: number;
  /** Another run refreshed the flight while this one asked the source: its answer is kept, this one is not stored. */
  skipped: number;
  /** The source does not know the number any more: the stored data is kept. */
  not_found: number;
  /** The source or the write failed: the stored data is kept. */
  failed: number;
}

type Outcome = "unchanged" | "changed" | "skipped" | "not_found" | "failed";

type Client = SupabaseClient<Database>;

type CandidateRow = Pick<
  Tables<"flights">,
  | "id"
  | "flight_number"
  | "status"
  | "scheduled_arrival_at"
  | "estimated_arrival_at"
  | "actual_arrival_at"
  | "terminal"
  | "delay_minutes"
  | "last_synced_at"
>;

async function refreshOne(supabase: Client, adapter: FlightSourceAdapter, flight: CandidateRow): Promise<Outcome> {
  try {
    const snapshot = await adapter.fetchFlight(flight.flight_number);
    if (!snapshot) return "not_found";

    const changes = diffFlight(flight, snapshot);
    const { data: stored, error } = await supabase.rpc("apply_flight_refresh", {
      p_flight_id: flight.id,
      p_values: {
        status: snapshot.status,
        estimated_arrival_at: snapshot.estimated_arrival_at,
        actual_arrival_at: snapshot.actual_arrival_at,
        terminal: snapshot.terminal,
        delay_minutes: snapshot.delay_minutes,
        provider: adapter.source,
      },
      p_changes: changes,
      p_source: toHistorySource(adapter.source),
      // The sync time that was read: if it moved, another run got there first and nothing is written.
      ...(flight.last_synced_at ? { p_expected_synced_at: flight.last_synced_at } : {}),
    });

    if (error) return "failed";
    if (!stored) return "skipped";
    return changes.length > 0 ? "changed" : "unchanged";
  } catch {
    // The source failed or timed out: the last good data stays, and the next run asks again.
    return "failed";
  }
}

/**
 * VI-F02-S03 (spec R7, R12, R13): asks the active source for every linked flight that is due, stores the
 * answer and keeps what changed in the history. Server-only. It runs as the system with a client that
 * bypasses RLS, because no user is signed in; the one write goes through `apply_flight_refresh`. One flight
 * that fails does not stop the others, and a failed flight keeps its data (its `last_synced_at` does not
 * move, so the panel shows it as stale with its age).
 */
export async function refreshFlights(
  supabase: Client,
  options: { now?: Date; source?: () => FlightSourceAdapter } = {},
): Promise<RefreshSummary> {
  const now = options.now ?? new Date();
  const adapter = (options.source ?? getFlightSource)();

  const { data, error } = await supabase
    .from("flights")
    .select(CANDIDATE_SELECT)
    .not("status", "in", "(landed,cancelled)")
    .not("bookings.status", "in", ENDED_BOOKING_STATUSES);

  if (error) throw error;

  const due = ((data ?? []) as CandidateRow[]).filter((flight) => isRefreshDue(flight, now));
  const outcomes: Outcome[] = [];

  for (let start = 0; start < due.length; start += CONCURRENCY) {
    const batch = due.slice(start, start + CONCURRENCY);
    outcomes.push(...(await Promise.all(batch.map((flight) => refreshOne(supabase, adapter, flight)))));
  }

  const count = (outcome: Outcome) => outcomes.filter((value) => value === outcome).length;

  return {
    checked: due.length,
    refreshed: count("unchanged") + count("changed"),
    changed: count("changed"),
    skipped: count("skipped"),
    not_found: count("not_found"),
    failed: count("failed"),
  };
}
