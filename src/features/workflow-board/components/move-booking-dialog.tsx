"use client";

import { useState } from "react";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMoveBooking } from "@/features/bookings/hooks/use-move-booking";
import { SEAT_FOLLOWS } from "@/features/bookings/lib/booking-move";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { SeatStatus } from "@/features/seats/types";
import { getMoveDialogState } from "@/features/workflow-board/lib/move-dialog-state";

interface MoveBookingDialogProps {
  bookingId: string;
  bookingNumber: string;
  status: BookingStatus;
  /** The step the booking moves to. */
  step: BookingStatus;
  /** "Partner · flight · airport"; may be empty. */
  summary: string;
  seatLabel: string | null;
  seatStatus: SeatStatus | null;
}

/**
 * "Move to {step}": the button on a card and the dialog it opens, as in the Figma frames. The dialog says
 * which seat status will follow, and in the same place why the move cannot be made: the seat is not
 * ready, the step cannot be skipped, the role is not allowed, or another user moved the booking first
 * (then Refresh replaces Move).
 */
export function MoveBookingDialog({
  bookingId,
  bookingNumber,
  status,
  step,
  summary,
  seatLabel,
  seatStatus,
}: MoveBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const { note, setNote, isPending, readiness, error, move, refresh, reset } = useMoveBooking({
    bookingId,
    status,
    step,
    seatStatus,
    onDone: () => setOpen(false),
  });

  const stepLabel = BOOKING_STATUS_LABEL[step];
  const seatFollows = SEAT_FOLLOWS[step];
  const { message, seatStatus: shownSeatStatus, conflict, forbidden, blocked } = getMoveDialogState(readiness, error);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={readiness.ok ? "default" : "outline"}
            className="min-h-11 w-full px-4"
            data-slot="move-booking-trigger"
          />
        }
      >
        Move to {stepLabel}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-0 p-6 pb-10 max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl leading-7 font-semibold text-foreground">
            Move {bookingNumber} to {stepLabel}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Moves the booking to the next step. The seat follows.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-10 flex flex-col gap-2 text-sm text-foreground">
          {summary && <p>{summary}</p>}
          {seatLabel && <p>{seatLabel}</p>}
        </div>

        {seatFollows && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Seat status that will follow</p>
            <Badge
              variant="info"
              className="h-8 w-[142px] justify-start gap-2.5 rounded-lg px-3 text-sm font-semibold text-seat-chip-fg [&>svg]:size-4! [&>svg]:text-muted-foreground"
            >
              <CheckIcon aria-hidden="true" />
              {SEAT_STATUS_LABEL[seatFollows.to]}
            </Badge>
          </div>
        )}

        {message && (
          <Alert className="mt-3 min-h-[104px] bg-info-bg text-info-fg">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertTitle className="font-semibold">{message}</AlertTitle>
          </Alert>
        )}

        {shownSeatStatus && (
          <p className="mt-3 text-sm font-semibold text-foreground">
            Current seat status: {SEAT_STATUS_LABEL[shownSeatStatus]}
          </p>
        )}

        {!forbidden && (
          <Textarea
            aria-label="Add a note (optional)"
            placeholder="Add a note (optional)"
            value={note}
            disabled={isPending}
            onChange={(event) => setNote(event.target.value)}
            className="mt-3 field-sizing-fixed h-[100px] min-h-[100px] resize-none px-3 py-3 text-sm"
          />
        )}

        <div className="mt-5 grid grid-cols-2 gap-4">
          {!forbidden &&
            (conflict ? (
              <Button type="button" className="min-h-11 px-6 font-semibold" onClick={refresh}>
                Refresh
              </Button>
            ) : (
              <Button
                type="button"
                className="min-h-11 px-6 font-semibold"
                disabled={blocked || isPending}
                aria-busy={isPending}
                onClick={move}
              >
                {isPending ? "Moving…" : "Move"}
              </Button>
            ))}
          <Button
            type="button"
            variant="outline"
            className="col-start-2 min-h-11 px-6 font-semibold"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
