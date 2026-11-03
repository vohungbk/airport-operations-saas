import { BoardBookingCard } from "@/features/workflow-board/components/board-booking-card";
import type { BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";
import type { Role } from "@/lib/auth/roles";

interface TechnicianStepCardsProps {
  column: BoardColumn;
  query: WorkflowBoardQuery;
  role: Role;
}

/** The cards of the selected step on a phone (CO-F08-T02): one list, one card per row, the Move button 44 px. */
export function TechnicianStepCards({ column, query, role }: TechnicianStepCardsProps) {
  const more = column.total - column.cards.length;

  return (
    <section aria-label={column.label} data-slot="technician-step-cards" className="flex flex-col gap-4">
      {column.cards.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No bookings in this step</p>
      )}
      {column.cards.map((card) => (
        <BoardBookingCard key={card.id} booking={card} query={query} selected={false} role={role} previewHref={null} />
      ))}
      {more > 0 && <p className="text-center text-sm text-muted-foreground">{more} more own jobs in this step</p>}
    </section>
  );
}
