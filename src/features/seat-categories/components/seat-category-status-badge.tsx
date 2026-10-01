import { CircleCheck, CircleOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface SeatCategoryStatusBadgeProps {
  isActive: boolean;
}

export const STATUS_VARIANT = {
  active: "success",
  inactive: "muted",
} as const;

/** Status is conveyed by icon and text, never by color alone. */
export function SeatCategoryStatusBadge({
  isActive,
}: SeatCategoryStatusBadgeProps) {
  if (isActive) {
    return (
      <Badge variant={STATUS_VARIANT.active}>
        <CircleCheck aria-hidden="true" />
        Active
      </Badge>
    );
  }

  return (
    <Badge variant={STATUS_VARIANT.inactive}>
      <CircleOff aria-hidden="true" />
      Inactive
    </Badge>
  );
}
