import {
  CircleCheckBig,
  CircleDot,
  Lock,
  SearchCheck,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  INCIDENT_STATUS_LABEL,
  type IncidentStatus,
} from "@/features/incidents/lib/incident-status";

interface IncidentStatusBadgeProps {
  status: IncidentStatus;
}

const STATUS_VARIANT = {
  open: "warning",
  investigating: "info",
  resolved: "success",
  closed: "muted",
} as const satisfies Record<IncidentStatus, string>;

const STATUS_ICON: Record<IncidentStatus, LucideIcon> = {
  open: CircleDot,
  investigating: SearchCheck,
  resolved: CircleCheckBig,
  closed: Lock,
};

/** Status is conveyed by icon and text, never by color alone. */
export function IncidentStatusBadge({ status }: IncidentStatusBadgeProps) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <Icon aria-hidden="true" />
      {INCIDENT_STATUS_LABEL[status]}
    </Badge>
  );
}
