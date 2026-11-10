import {
  BadgeCheck,
  CircleCheck,
  CircleCheckBig,
  CirclePlay,
  CircleX,
  Clock,
  Navigation,
  PackageCheck,
  Search,
  Sparkles,
  Undo2,
  UserCheck,
  UserX,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";

interface BookingStatusBadgeProps {
  status: BookingStatus;
  className?: string;
}

export const STATUS_VARIANT = {
  pending: "warning",
  confirmed: "info",
  preparation: "info",
  ready: "info",
  assigned: "info",
  en_route: "info",
  installed: "info",
  family_ready: "info",
  in_progress: "info",
  returned: "info",
  cleaning: "warning",
  inspection: "warning",
  completed: "success",
  cancelled: "muted",
  no_show: "destructive",
} as const satisfies Record<BookingStatus, string>;

const STATUS_ICON: Record<BookingStatus, LucideIcon> = {
  pending: Clock,
  confirmed: CircleCheck,
  preparation: Wrench,
  ready: BadgeCheck,
  assigned: UserCheck,
  en_route: Navigation,
  installed: PackageCheck,
  family_ready: Users,
  in_progress: CirclePlay,
  returned: Undo2,
  cleaning: Sparkles,
  inspection: Search,
  completed: CircleCheckBig,
  cancelled: CircleX,
  no_show: UserX,
};

/** Status is conveyed by icon and text, never by color alone. */
export function BookingStatusBadge({ status, className }: BookingStatusBadgeProps) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      <Icon aria-hidden="true" />
      {BOOKING_STATUS_LABEL[status]}
    </Badge>
  );
}
