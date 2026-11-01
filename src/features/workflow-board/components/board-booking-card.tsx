import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buildWorkflowBoardHref } from "@/features/workflow-board/lib/build-workflow-board-href";
import type { BoardCardItem } from "@/features/workflow-board/lib/get-workflow-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import { cn } from "@/lib/utils";

interface BoardBookingCardProps {
  booking: BoardCardItem;
  /** The filters in force: the card keeps them in its address and adds the booking to preview. */
  query: WorkflowBoardQuery;
  selected: boolean;
}

/** One booking on the board. The whole card is the link that opens the preview of the booking. */
export function BoardBookingCard({ booking, query, selected }: BoardBookingCardProps) {
  return (
    <Link
      href={buildWorkflowBoardHref({ ...query, booking: booking.id })}
      aria-current={selected ? "true" : undefined}
      data-slot="board-booking-card"
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card p-4 text-sm shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "border-2 border-primary",
      )}
    >
      <span className="truncate font-medium text-primary">{booking.booking_number}</span>
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
    </Link>
  );
}
