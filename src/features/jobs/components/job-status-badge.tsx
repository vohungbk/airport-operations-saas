import {
  CircleCheckBig,
  CirclePlay,
  CircleX,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABEL, type JobStatus } from "@/features/jobs/lib/job-status";

interface JobStatusBadgeProps {
  status: JobStatus;
}

const STATUS_VARIANT = {
  assigned: "info",
  in_progress: "info",
  completed: "success",
  cancelled: "muted",
} as const satisfies Record<JobStatus, string>;

const STATUS_ICON: Record<JobStatus, LucideIcon> = {
  assigned: UserCheck,
  in_progress: CirclePlay,
  completed: CircleCheckBig,
  cancelled: CircleX,
};

/** Status is conveyed by icon and text, never by color alone. */
export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const Icon = STATUS_ICON[status];

  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <Icon aria-hidden="true" />
      {JOB_STATUS_LABEL[status]}
    </Badge>
  );
}
