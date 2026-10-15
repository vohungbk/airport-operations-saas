import { PageNotFound } from "@/components/shared/page-state";

/**
 * Shown for an unknown id and for a job RLS hides (for example one that was
 * unassigned from the technician). The two look the same on purpose.
 */
export default function JobNotFound() {
  return (
    <PageNotFound
      title="Job not found"
      description="This job does not exist or is no longer assigned to you."
      backHref="/jobs"
      backLabel="Back to jobs"
    />
  );
}
