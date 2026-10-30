"use client";

import { useState, useTransition } from "react";

import { runClientAction } from "@/lib/actions/run-client-action";
import { moveSettlementStatusAction } from "@/features/settlements/actions/move-settlement-status.action";
import { NETWORK_ERROR, type SettlementActionError } from "@/features/settlements/lib/settlement-errors";
import type { SettlementStatus } from "@/features/settlements/lib/settlement";

export function useMoveSettlementStatus(settlementId: string) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<SettlementActionError | null>(null);

  const move = (to: SettlementStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await runClientAction(
        () => moveSettlementStatusAction({ settlement_id: settlementId, to_status: to }),
        NETWORK_ERROR,
      );

      if (!result.success) {
        setError(result.error ?? NETWORK_ERROR);
      }
    });
  };

  return { move, isPending, error };
}
