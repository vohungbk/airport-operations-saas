import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  isJobUnavailableError,
  type JobActionError,
} from "@/features/jobs/lib/job-errors";

interface JobStatusErrorAlertProps {
  error: JobActionError;
}

/**
 * Error of a status change. When the job is out of the user's reach (for
 * example it was unassigned while the page was open) the user is pointed
 * back to the job list instead of being left to retry.
 */
export function JobStatusErrorAlert({ error }: JobStatusErrorAlertProps) {
  const unavailable = isJobUnavailableError(error);
  const title =
    error.code === "FORBIDDEN"
      ? "You no longer have access to this action"
      : unavailable
        ? "This job is no longer available"
        : "Could not update status";

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
