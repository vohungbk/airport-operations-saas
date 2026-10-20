import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import type { JobActionError } from "@/features/jobs/lib/job-errors";
import { isIncidentUnavailableError } from "@/features/incidents/lib/incident-errors";

interface IncidentActionErrorAlertProps {
  error: JobActionError;
  /** Title for an error a retry can fix; the action the user was doing. */
  fallbackTitle?: string;
}

/**
 * Error of an incident action. When the incident is out of the user's reach
 * (or the role no longer allows the change) the user is pointed back to the
 * list instead of being left to retry.
 */
export function IncidentActionErrorAlert({
  error,
  fallbackTitle = "Could not update status",
}: IncidentActionErrorAlertProps) {
  const unavailable = isIncidentUnavailableError(error);
  const title =
    error.code === "FORBIDDEN"
      ? "You no longer have access to this action"
      : unavailable
        ? "This incident is no longer available"
        : fallbackTitle;

  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {error.message}
        {unavailable && (
          <Link
            href="/incidents"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to incidents
          </Link>
        )}
      </AlertDescription>
    </Alert>
  );
}
