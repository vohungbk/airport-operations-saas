import Link from "next/link";
import { EqualIcon, PlaneIcon, TriangleAlertIcon } from "lucide-react";

import { getNextStep, mayRoleMoveTo } from "@/features/bookings/lib/booking-move";
import { MoveBookingDialog } from "@/features/workflow-board/components/move-booking-dialog";
import { buildWorkflowBoardHref } from "@/features/workflow-board/lib/build-workflow-board-href";
import { getCardMoveNote } from "@/features/workflow-board/lib/card-move-note";
import type { BoardCardItem } from "@/features/workflow-board/lib/get-workflow-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import type { Role } from "@/lib/auth/roles";
import { BOARD_PRIORITY_SHORT_LABEL, type BoardPriority } from "@/lib/workflow/board";
import { cn } from "@/lib/utils";

interface BoardBookingCardProps {
  booking: BoardCardItem;
  /** The filters in force: the booking number keeps them in its address and adds the booking to preview. */
  query: WorkflowBoardQuery;
  selected: boolean;
  /** The role of the person looking: the Move button is shown only when the role may move to the next step. */
  role: Role;
  /** Where the booking number goes; `null` shows it as plain text (a technician has no preview). Default: the preview of the admin board. */
  previewHref?: string | null;
}

const PRIORITY_ICON: Record<BoardPriority, typeof EqualIcon> = {
  normal: EqualIcon,
  high: TriangleAlertIcon,
  urgent: TriangleAlertIcon,
};

/** One line of the card that warns (a flight alert or an overdue step): an icon and text, in the danger color. */
function WarningLine({ children }: { children: string }) {
  return (
    <span className="flex items-center gap-2 text-danger-fg">
      <TriangleAlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

/**
 * One booking on the board, as the Figma frame D4 draws it. The booking number is the link that opens the preview
 * of the booking; the button below moves the booking to its next step (CO-F08-S03). A booking whose seat is not
 * ready keeps the button, quiet, with the reason under it; the dialog says the same.
 */
export function BoardBookingCard({ booking, query, selected, role, previewHref }: BoardBookingCardProps) {
  const next = getNextStep(booking.status);
  const PriorityIcon = PRIORITY_ICON[booking.priority];
  const href = previewHref === undefined ? buildWorkflowBoardHref({ ...query, booking: booking.id }) : previewHref;
  const canMove = next !== null && mayRoleMoveTo(role, next);
  const note = canMove ? getCardMoveNote(next, booking.seat_status) : null;

  return (
    <div
      aria-current={selected ? "true" : undefined}
      data-slot="board-booking-card"
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-md border border-border bg-card p-3.5 text-[13px] leading-[19px] text-foreground",
        selected && "border-2 border-primary",
      )}
    >
      {href === null ? (
        <span className="truncate text-body font-semibold text-primary">{booking.booking_number}</span>
      ) : (
        <Link
          href={href}
          className="truncate text-body font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {booking.booking_number}
        </Link>
      )}
      {booking.partner_name && <span className="truncate">{booking.partner_name}</span>}
      {booking.flight_number && (
        <span
          data-slot="board-flight-chip"
          className="inline-flex h-[26px] w-fit max-w-full items-center gap-1.5 rounded-sm bg-primary-subtle px-1.5 font-semibold"
        >
          <PlaneIcon aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{booking.flight_number}</span>
        </span>
      )}
      {booking.seat_label && <span className="truncate">{booking.seat_label}</span>}
      <span className="truncate">{booking.pickup_label}</span>
      <span
        data-slot="board-priority"
        data-priority={booking.priority}
        className="flex h-[26px] items-center gap-2 font-semibold"
      >
        <PriorityIcon aria-hidden="true" className="size-3.5 shrink-0" />
        {BOARD_PRIORITY_SHORT_LABEL[booking.priority]}
      </span>
      {booking.flight_alert && <WarningLine>{booking.flight_alert.label}</WarningLine>}
      {booking.overdue_label && <WarningLine>{booking.overdue_label}</WarningLine>}
      {booking.time_in_step_label && <span className="text-muted-foreground">{booking.time_in_step_label}</span>}
      {canMove && next && (
        <div className="mt-2 flex flex-col gap-3">
          <MoveBookingDialog
            bookingId={booking.id}
            bookingNumber={booking.booking_number}
            status={booking.status}
            step={next}
            summary={booking.summary}
            seatLabel={booking.seat_label}
            seatStatus={booking.seat_status}
          />
          {note && (
            <span data-slot="board-move-note" className="text-danger-fg">
              {note}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
