import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  INCIDENTS_ACCESS_PERMISSIONS,
  INCIDENT_REPORT_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { IncidentReportForm } from "@/features/incidents/components/incident-report-form";
import { getIncidentJobOptions } from "@/features/incidents/lib/get-incident-job-options";

interface NewIncidentPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The incidents layout lets reporters in; the list and the detail guard
 * themselves with `incidents:view`. RLS gives the job choices: a technician's
 * own jobs, or every job for a manager.
 */
export default async function NewIncidentPage({
  searchParams,
}: NewIncidentPageProps) {
  const user = await requireAnyPermission(INCIDENT_REPORT_PERMISSIONS);

  const [jobs, params] = await Promise.all([
    getIncidentJobOptions(),
    searchParams,
  ]);
  // Only a job the user can report on is selected first.
  const requested = typeof params.job_id === "string" ? params.job_id : "";
  const initialJobId = jobs.some((job) => job.id === requested) ? requested : "";
  const cancelHref = hasAnyPermission(user.role, INCIDENTS_ACCESS_PERMISSIONS)
    ? "/incidents"
    : "/jobs";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Report incident
      </h1>
      <div className="max-w-lg">
        <IncidentReportForm
          jobs={jobs}
          initialJobId={initialJobId}
          cancelHref={cancelHref}
        />
      </div>
    </div>
  );
}
