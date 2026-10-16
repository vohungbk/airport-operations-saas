import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  isJobUnavailableError,
  type JobActionError,
} from "@/features/jobs/lib/job-errors";

interface JobActionErrorAlertProps {
  error: JobActionError;
  /** Title for an error a retry can fix; the action the user was doing. */
  fallbackTitle?: string;
}

/**
 * Error of a job action (a status change, recording work). When the job is
 * out of the user's reach (for example it was unassigned while the page was
 * open) the user is pointed back to the job list instead of being left to
 * retry.
 */
export function JobActionErrorAlert({
  error,
  fallbackTitle = "Could not update status",
}: JobActionErrorAlertProps) {
  const unavailable = isJobUnavailableError(error);
  const title =
    error.code === "FORBIDDEN"
      ? "You no longer have access to this action"
      : unavailable
        ? "This job is no longer available"
        : fallbackTitle;

  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        {error.message}
        {unavailable && (
          <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
            Back to jobs
          </Link>
        )}
      </AlertDescription>
    </Alert>
  );
}
