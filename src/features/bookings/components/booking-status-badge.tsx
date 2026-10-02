import {
  CircleCheck,
  CircleCheckBig,
  CirclePlay,
  CircleX,
  Clock,
  UserCheck,
  UserX,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

export const STATUS_VARIANT = {
  pending: "warning",
  confirmed: "info",
  assigned: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "muted",
  no_show: "destructive",
} as const satisfies Record<BookingStatus, string>;

const STATUS_ICON: Record<BookingStatus, LucideIcon> = {
  pending: Clock,
  confirmed: CircleCheck,
  assigned: UserCheck,
  in_progress: CirclePlay,
  completed: CircleCheckBig,
  cancelled: CircleX,
  no_show: UserX,
};

/** Status is conveyed by icon and text, never by color alone. */
export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <Icon aria-hidden="true" />
      {BOOKING_STATUS_LABEL[status]}
    </Badge>
  );
}
