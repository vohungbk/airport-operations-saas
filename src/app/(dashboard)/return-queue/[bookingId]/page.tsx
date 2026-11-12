import { forbidden } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { RETURN_CHAIN_STEP_PERMISSIONS } from "@/lib/auth/permissions";
import { RETURN_QUEUE_ROUTE } from "@/lib/constants/routes";
import { PageNotFound } from "@/components/shared/page-state";
import { ReturnChainStep } from "@/features/return-queue/components/return-chain-step";
import {
  chainStepAccessLabel,
  chainStepBackHref,
  isAssignedWorkOnly,
} from "@/features/return-queue/lib/chain-step-access";
import { getReturnChainItem } from "@/features/return-queue/lib/get-return-queue";

interface ReturnChainStepPageProps {
  params: Promise<{ bookingId: string }>;
}

/**
 * Independent second guard alongside the layout's. A booking the user cannot
 * read, a missing one and one that is not in the chain all show the same
 * state, so an out-of-scope id reveals nothing: not-found for internal roles,
 * forbidden for a technician (FO-F08-S08, E6), who sees only their own work.
 */
export default async function ReturnChainStepPage({
  params,
}: ReturnChainStepPageProps) {
  const user = await requireAnyPermission(RETURN_CHAIN_STEP_PERMISSIONS);
  const { bookingId } = await params;
  const now = new Date();
  const item = await getReturnChainItem(bookingId, now);

  if (!item) {
    if (isAssignedWorkOnly(user.role)) {
      forbidden();
    }

    return (
      <PageNotFound
        title="Seat not in the return queue"
        description="This seat was not found, is not in the return chain, or is not within your access."
        backHref={RETURN_QUEUE_ROUTE}
        backLabel="Back to Return queue"
      />
    );
  }

  return (
    <ReturnChainStep
      item={item}
      accessLabel={chainStepAccessLabel(user.role)}
      backHref={chainStepBackHref(user.role)}
      now={now}
    />
  );
}
