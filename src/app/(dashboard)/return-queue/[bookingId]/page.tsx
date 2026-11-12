import { requirePermission } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/role-labels";
import { PageNotFound } from "@/components/shared/page-state";
import { ReturnChainStep } from "@/features/return-queue/components/return-chain-step";
import { getReturnChainItem } from "@/features/return-queue/lib/get-return-queue";

interface ReturnChainStepPageProps {
  params: Promise<{ bookingId: string }>;
}

/**
 * Independent second guard alongside the layout's. A booking the user cannot
 * read, a missing one and one that is not in the chain all show the same
 * not-found state, so an out-of-scope id reveals nothing.
 */
export default async function ReturnChainStepPage({
  params,
}: ReturnChainStepPageProps) {
  const user = await requirePermission("dashboards:view");
  const { bookingId } = await params;
  const item = await getReturnChainItem(bookingId, new Date());

  if (!item) {
    return (
      <PageNotFound
        title="Seat not in the return queue"
        description="This seat was not found, is not in the return chain, or is not within your access."
        backHref="/return-queue"
        backLabel="Back to Return queue"
      />
    );
  }

  return (
    <ReturnChainStep
      item={item}
      accessLabel={`${ROLE_LABELS[user.role]} · Full access`}
    />
  );
}
