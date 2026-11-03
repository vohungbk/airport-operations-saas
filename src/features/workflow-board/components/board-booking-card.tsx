import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getNextStep, mayRoleMoveTo } from "@/features/bookings/lib/booking-move";
import { MoveBookingDialog } from "@/features/workflow-board/components/move-booking-dialog";
import { buildWorkflowBoardHref } from "@/features/workflow-board/lib/build-workflow-board-href";
import type { BoardCardItem } from "@/features/workflow-board/lib/get-workflow-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

interface BoardBookingCardProps {
  booking: BoardCardItem;
  /** The filters in force: the booking number keeps them in its address and adds the booking to preview. */
  query: WorkflowBoardQuery;
  selected: boolean;
  /** The role of the person looking: the Move button is shown only when the role may move to the next step. */
  role: Role;
}

/**
 * One booking on the board. The booking number is the link that opens the preview of the booking;
 * the button below it moves the booking to its next step (CO-F08-S03).
 */
export function BoardBookingCard({ booking, query, selected, role }: BoardBookingCardProps) {
  const next = getNextStep(booking.status);

  return (
    <div
      aria-current={selected ? "true" : undefined}
      data-slot="board-booking-card"
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-4 text-sm shadow-xs",
        selected && "border-2 border-primary",
      )}
    >
      <Link
        href={buildWorkflowBoardHref({ ...query, booking: booking.id })}
        className="truncate font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {booking.booking_number}
      </Link>
      {booking.overdue && (
        <Badge variant="destructive" className="w-fit">
          Overdue
        </Badge>
      )}
      {booking.partner_name && (
        <span className="truncate text-muted-foreground">{booking.partner_name}</span>
      )}
      {booking.flight_number && (
        <Badge variant="muted" className="w-fit">
          {booking.flight_number}
        </Badge>
      )}
      {booking.seat_label && <span className="truncate text-foreground">{booking.seat_label}</span>}
      <span className="truncate text-muted-foreground">{booking.pickup_label}</span>
      {next && mayRoleMoveTo(role, next) && (
        <div className="mt-2">
          <MoveBookingDialog
            bookingId={booking.id}
            bookingNumber={booking.booking_number}
            status={booking.status}
            step={next}
            summary={booking.summary}
            seatLabel={booking.seat_label}
            seatStatus={booking.seat_status}
          />
        </div>
      )}
    </div>
  );
}
