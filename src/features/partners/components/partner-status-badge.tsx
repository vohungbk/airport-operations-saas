import { Badge } from "@/components/ui/badge";
import type { PartnerStatus } from "@/features/partners/types";

interface PartnerStatusBadgeProps {
  status: PartnerStatus;
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

export function PartnerStatusBadge({ status }: PartnerStatusBadgeProps) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
