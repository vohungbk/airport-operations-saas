import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { JOBS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { getJobById } from "@/features/jobs/lib/get-job-by-id";
import { JobDetail } from "@/features/jobs/components/job-detail";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * RLS scopes the row: a technician gets `null` (so `notFound()`) for any
 * job that is not theirs, indistinguishable from a missing id.
 */
export default async function JobDetailPage({ params }: JobDetailPageProps) {
  await requireAnyPermission(JOBS_ACCESS_PERMISSIONS);

  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  return <JobDetail job={job} />;
}
