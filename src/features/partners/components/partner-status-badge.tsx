import { Badge } from "@/components/ui/badge";
import type { PartnerStatus } from "@/features/partners/types";

interface PartnerStatusBadgeProps {
  status: PartnerStatus;
  /** A small dot before the label, as in the Partners list. */
  showDot?: boolean;
}

export const STATUS_VARIANT: Record<
  PartnerStatus,
  "success" | "warning" | "muted"
> = {
  pending: "warning",
  active: "success",
  suspended: "warning",
  inactive: "muted",
};

export const STATUS_LABEL: Record<PartnerStatus, string> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  inactive: "Inactive",
};

export function PartnerStatusBadge({
  status,
  showDot = false,
}: PartnerStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {showDot ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      ) : null}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
