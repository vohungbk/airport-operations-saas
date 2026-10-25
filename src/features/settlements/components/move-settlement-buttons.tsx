"use client";

import { Button } from "@/components/ui/button";
import { useMoveSettlementStatus } from "@/features/settlements/hooks/use-move-settlement-status";
import { SETTLEMENT_MOVES, type SettlementStatus } from "@/features/settlements/lib/settlement";

interface MoveSettlementButtonsProps {
  settlementId: string;
  status: SettlementStatus;
}

/**
 * VI-F04 S4 (R8): the moves an admin can make from the current status. Presentation only: the Server
 * Action and the database function decide whether a move is allowed.
 */
export function MoveSettlementButtons({ settlementId, status }: MoveSettlementButtonsProps) {
  const { move, isPending, error } = useMoveSettlementStatus(settlementId);
  const moves = SETTLEMENT_MOVES[status];

  if (moves.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {moves.map((item) => (
          <Button
            key={item.to}
            type="button"
            size="sm"
            variant={item.to === "draft" ? "outline" : "default"}
            disabled={isPending}
            onClick={() => move(item.to)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
