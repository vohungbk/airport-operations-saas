import {
  CircleAlert,
  Info,
  OctagonAlert,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  INCIDENT_SEVERITY_LABEL,
  type IncidentSeverity,
} from "@/features/incidents/lib/incident-severity";

interface IncidentSeverityBadgeProps {
  severity: IncidentSeverity;
}

const SEVERITY_VARIANT = {
  low: "muted",
  medium: "info",
  high: "warning",
  critical: "destructive",
} as const satisfies Record<IncidentSeverity, string>;

const SEVERITY_ICON: Record<IncidentSeverity, LucideIcon> = {
  low: Info,
  medium: CircleAlert,
  high: TriangleAlert,
  critical: OctagonAlert,
};

/** Severity is conveyed by icon and text, never by color alone. */
export function IncidentSeverityBadge({
  severity,
}: IncidentSeverityBadgeProps) {
  const Icon = SEVERITY_ICON[severity];

  return (
    <Badge variant={SEVERITY_VARIANT[severity]}>
      <Icon aria-hidden="true" />
      {INCIDENT_SEVERITY_LABEL[severity]}
    </Badge>
  );
}
