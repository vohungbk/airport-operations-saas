import type { BookingStatus } from "@/features/bookings/types";
import type { SeatStatus } from "@/features/seats/types";
import {
  chainStepOf,
  currentStepLabel,
  queueStepOf,
  RETURN_QUEUE_STEPS,
  type ReturnChainBookingStatus,
  type ReturnChainStep,
  type ReturnQueueStep,
} from "@/features/return-queue/lib/return-chain";
import type { ReturnQueueQuery } from "@/features/return-queue/schemas/return-queue-query.schema";

/** A booking in the chain as the query returns it. */
export interface ReturnQueueBookingRow {
  id: string;
  booking_number: string;
  status: ReturnChainBookingStatus;
  airport: { code: string; timezone: string } | null;
  partner: { name: string } | null;
  seat: { id: string; serial_number: string; status: SeatStatus } | null;
  events: { to_status: BookingStatus; created_at: string }[];
}

/** One row of the queue. */
export interface ReturnQueueItem {
  booking_id: string;
  booking_number: string;
  seat_serial_number: string | null;
  seat_status: SeatStatus | null;
  partner_name: string | null;
  airport_code: string | null;
  time_zone: string;
  chain_step: ReturnChainStep;
  queue_step: ReturnQueueStep;
  current_step_label: string;
  /** When the booking became Returned; null when no event says so. */
  returned_at: string | null;
  /** When the booking entered its current step; null when no event says so. */
  step_started_at: string | null;
  /** Minutes since the current step began; null without a start time. */
  waiting_minutes: number | null;
}

function latestEventAt(
  events: ReturnQueueBookingRow["events"],
  status: BookingStatus,
): string | null {
  let latest: string | null = null;

  for (const event of events) {
    if (event.to_status === status && (!latest || event.created_at > latest)) {
      latest = event.created_at;
    }
  }

  return latest;
}

/** The queue row of a booking at `now`. Pure. */
export function toReturnQueueItem(
  row: ReturnQueueBookingRow,
  now: Date,
): ReturnQueueItem {
  const seatStatus = row.seat?.status ?? null;
  const stepStartedAt = latestEventAt(row.events, row.status);

  return {
    booking_id: row.id,
    booking_number: row.booking_number,
    seat_serial_number: row.seat?.serial_number ?? null,
    seat_status: seatStatus,
    partner_name: row.partner?.name ?? null,
    airport_code: row.airport?.code ?? null,
    time_zone: row.airport?.timezone ?? "UTC",
    chain_step: chainStepOf(row.status),
    queue_step: queueStepOf(row.status, seatStatus),
    current_step_label: currentStepLabel(row.status, seatStatus),
    returned_at: latestEventAt(row.events, "returned"),
    step_started_at: stepStartedAt,
    waiting_minutes: stepStartedAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - new Date(stepStartedAt).getTime()) / 60_000),
        )
      : null,
  };
}

function matchesSearch(item: ReturnQueueItem, q: string | undefined): boolean {
  if (!q) return true;

  const needle = q.toLowerCase();

  return [item.seat_serial_number, item.booking_number].some((value) =>
    value?.toLowerCase().includes(needle),
  );
}

export interface ReturnQueueView {
  /** The rows of the current page. */
  items: ReturnQueueItem[];
  /** Rows that match the search and the step. */
  total: number;
  /** Rows that match the search, by step; the step chips show these. */
  step_counts: Record<ReturnQueueStep, number>;
  /** Rows that match the search, any step. */
  all_count: number;
}

/**
 * Search, step counts, step filter, longest wait first, then the page. Pure.
 * The airport filter and the tenant scope are applied by the query and RLS.
 */
export function buildReturnQueueView(
  items: ReturnQueueItem[],
  query: ReturnQueueQuery,
): ReturnQueueView {
  const searched = items.filter((item) => matchesSearch(item, query.q));
  const step_counts = Object.fromEntries(
    RETURN_QUEUE_STEPS.map((step) => [
      step,
      searched.filter((item) => item.queue_step === step).length,
    ]),
  ) as Record<ReturnQueueStep, number>;
  const filtered = query.step
    ? searched.filter((item) => item.queue_step === query.step)
    : searched;
  const sorted = [...filtered].sort(
    (a, b) =>
      (b.waiting_minutes ?? -1) - (a.waiting_minutes ?? -1) ||
      a.booking_number.localeCompare(b.booking_number),
  );
  const start = (query.page - 1) * query.page_size;

  return {
    items: sorted.slice(start, start + query.page_size),
    total: filtered.length,
    step_counts,
    all_count: searched.length,
  };
}
