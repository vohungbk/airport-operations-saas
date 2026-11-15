import { requirePermission } from "@/lib/auth/current-user";
import { PageForbidden } from "@/components/shared/page-state";
import { JobInformation } from "@/features/jobs/components/job-information";
import { getJobInformation } from "@/features/jobs/lib/get-job-information";

interface JobInformationPageProps {
  params: Promise<{ id: string }>;
}

/**
 * UI-F07-S02: the information of a job opened from Today's Jobs. The path is `/technician/[id]` so the arrow
 * of the app bar goes back to Today's Jobs. The page checks the permission on the server; RLS scopes the job,
 * so a job that is not the technician's, or does not exist, shows the same forbidden state and never says
 * which. A failed read throws to `error.tsx`.
 */
export default async function JobInformationPage({ params }: JobInformationPageProps) {
  await requirePermission("jobs:view_assigned");

  const { id } = await params;
  const job = await getJobInformation(id);

  if (!job) {
    return (
      <PageForbidden
        title="You cannot open this job"
        description="This job was not found or is not assigned to you."
      />
    );
  }

  return <JobInformation job={job} now={new Date()} />;
}
