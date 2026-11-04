import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { JobDeadlineView } from "@/features/jobs/lib/job-deadline";

interface JobDeadlineCellProps {
  view: JobDeadlineView;
}

/**
 * The Deadline cell of the jobs list (UI-F06-T01, frame `Jobs content`): the date, or an Overdue badge
 * with the date in red under it, or `No deadline`. Overdue is told by the icon and the words as well as
 * the color.
 */
export function JobDeadlineCell({ view }: JobDeadlineCellProps) {
  if (view.kind === "none") return <span>No deadline</span>;
  if (view.kind === "on_time") return <span>{view.label}</span>;

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="warning">
        <TriangleAlertIcon aria-hidden="true" />
        Overdue
      </Badge>
      <span className="text-danger-fg">Overdue: {view.label}</span>
    </div>
  );
}
