"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/ui/toast";
import { moveBookingAction } from "@/features/bookings/actions/move-booking.action";
import { checkMoveReadiness } from "@/features/bookings/lib/booking-move";
import type { BookingActionResult } from "@/features/bookings/lib/booking-errors";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { runBookingAction } from "@/features/bookings/lib/run-booking-action";
import type { BookingStatus } from "@/features/bookings/types";
import type { SeatStatus } from "@/features/seats/types";

interface UseMoveBookingArgs {
  bookingId: string;
  /** The step the booking is at as the person sees it; sent so a move on a stale view is refused. */
  status: BookingStatus;
  /** The step the dialog moves it to. */
  step: BookingStatus;
  /** The status of the assigned seat, `null` when there is none. */
  seatStatus: SeatStatus | null;
  onDone: () => void;
}

/**
 * The state and actions of the Move dialog (CO-F08-S03). Whether the seat lets the move happen is
 * known before the person clicks, so the dialog can say so at once; the database decides in the end.
 */
export function useMoveBooking({ bookingId, status, step, seatStatus, onDone }: UseMoveBookingArgs) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [result, setResult] = useState<BookingActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const readiness = checkMoveReadiness(step, seatStatus ? { status: seatStatus } : null);
  const error = result && !result.success ? result.error : undefined;

  function move() {
    if (!readiness.ok) return;

    setResult(null);
    startTransition(async () => {
      const next = await runBookingAction(() =>
        moveBookingAction({ booking_id: bookingId, expected_status: status, note }),
      );
      setResult(next);

      if (next.success) {
        toast(`Moved to ${BOOKING_STATUS_LABEL[step]}`, "success");
        onDone();
        // Re-runs the Server Component fetch so the board shows the booking in its new step.
        router.refresh();
      }
    });
  }

  /** After a conflict: close the dialog and read the board again, where the booking is at its current step. */
  function refresh() {
    onDone();
    router.refresh();
  }

  function reset() {
    setResult(null);
    setNote("");
  }

  return { note, setNote, isPending, readiness, error, move, refresh, reset };
}
