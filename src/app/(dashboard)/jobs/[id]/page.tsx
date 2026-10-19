import { notFound } from "next/navigation";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  INCIDENT_REPORT_PERMISSIONS,
  JOBS_ACCESS_PERMISSIONS,
  JOB_STATUS_UPDATE_PERMISSIONS,
  hasAnyPermission,
  hasPermission,
} from "@/lib/auth/permissions";
import { getJobById } from "@/features/jobs/lib/get-job-by-id";
import { getJobEvents } from "@/features/jobs/lib/get-job-events";
import { getAllowedJobTransitions } from "@/features/jobs/lib/job-status";
import { getWorkRecordHref } from "@/features/jobs/lib/work-record";
import { JobDetail } from "@/features/jobs/components/job-detail";

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * RLS scopes the row: a technician gets `null` (so `notFound()`) for any
 * job that is not theirs, indistinguishable from a missing id. The status
 * control is hidden when the user has no permitted transition; the database
 * function enforces the same rules. The "Record work" link is only offered
 * when the matching workflow screen is available for this user and job.
 */
export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const user = await requireAnyPermission(JOBS_ACCESS_PERMISSIONS);

  const { id } = await params;
  const [job, { events, truncated }] = await Promise.all([
    getJobById(id),
    getJobEvents(id),
  ]);

  if (!job) {
    notFound();
  }

  const allowedStatuses = hasAnyPermission(
    user.role,
    JOB_STATUS_UPDATE_PERMISSIONS,
  )
    ? getAllowedJobTransitions(job.status, {
        canCancel: hasPermission(user.role, "technicians:manage"),
      })
    : [];

  return (
    <JobDetail
      job={job}
      events={events}
      eventsTruncated={truncated}
      allowedStatuses={allowedStatuses}
      workRecordHref={getWorkRecordHref(job, user)}
      reportIncidentHref={
        hasAnyPermission(user.role, INCIDENT_REPORT_PERMISSIONS)
          ? `/incidents/new?job_id=${job.id}`
          : null
      }
    />
  );
}
