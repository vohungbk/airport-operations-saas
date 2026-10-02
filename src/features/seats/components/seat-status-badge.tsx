import {
  CircleCheck,
  CircleDashed,
  CirclePlay,
  CircleSlash,
  ClipboardCheck,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { SEAT_STATUS_LABEL } from "@/features/seats/lib/seat-status";
import type { SeatStatus } from "@/features/seats/types";

interface SeatStatusBadgeProps {
  status: SeatStatus;
}

export const STATUS_VARIANT = {
  available: "success",
  reserved: "info",
  in_use: "info",
  cleaning: "warning",
  inspection: "warning",
  quarantine: "destructive",
  retired: "muted",
} as const satisfies Record<SeatStatus, string>;

const STATUS_ICON: Record<SeatStatus, LucideIcon> = {
  available: CircleCheck,
  reserved: CircleDashed,
  in_use: CirclePlay,
  cleaning: Sparkles,
  inspection: ClipboardCheck,
  quarantine: ShieldAlert,
  retired: CircleSlash,
};

/** Status is conveyed by icon and text, never by color alone. */
export function SeatStatusBadge({ status }: SeatStatusBadgeProps) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <Icon aria-hidden="true" />
      {SEAT_STATUS_LABEL[status]}
    </Badge>
  );
}
