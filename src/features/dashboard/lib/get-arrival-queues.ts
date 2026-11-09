import { createClient } from "@/lib/supabase/server";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { formatPickup } from "@/features/bookings/lib/booking-time";
import type { BookingStatus } from "@/features/bookings/types";

export interface ArrivalQueueItem {
  booking_id: string;
  booking_number: string;
  /** The status in the words of the design (for example `Technician Assigned`). */
  status_label: string;
  /** The expected arrival in the time zone of the airport (for example `15:45 GST`). */
  arrival_label: string;
}

export interface ArrivalQueues {
  arrivals_today: ArrivalQueueItem[];
  upcoming_bookings: ArrivalQueueItem[];
}

interface ArrivalQueueRow {
  queue: string;
  booking_id: string;
  booking_number: string;
  status: string;
  expected_at: string;
  timezone: string;
}

/** Today's arrivals show the time; an upcoming booking is on a later day, so its label has the date too. */
export function toArrivalQueues(rows: readonly ArrivalQueueRow[]): ArrivalQueues {
  const item = (row: ArrivalQueueRow): ArrivalQueueItem => ({
    booking_id: row.booking_id,
    booking_number: row.booking_number,
    status_label: BOOKING_STATUS_LABEL[row.status as BookingStatus] ?? row.status,
    arrival_label: formatPickup(row.expected_at, row.timezone, row.queue === "upcoming"),
  });

  return {
    arrivals_today: rows.filter((row) => row.queue === "arrivals").map(item),
    upcoming_bookings: rows.filter((row) => row.queue === "upcoming").map(item),
  };
}

/**
 * Server-only. Today's arrivals and the upcoming bookings of the Command Centre, five of each at most,
 * read as the signed-in user so RLS is the scope. The function follows the rule of the Arrivals today tile
 * and puts early flights first. A failed read gives `null` (a dash), never an empty list that says nothing
 * is coming.
 */
export async function getArrivalQueues(now: Date = new Date()): Promise<ArrivalQueues | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("command_centre_arrival_queues", {
      p_now: now.toISOString(),
    });

    return error || !data ? null : toArrivalQueues(data);
  } catch {
    return null;
  }
}
