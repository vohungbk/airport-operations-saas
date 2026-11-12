import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  INCIDENTS_ACCESS_PERMISSIONS,
  INCIDENT_REPORT_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { IncidentReportForm } from "@/features/incidents/components/incident-report-form";
import { formatReportStamp } from "@/features/incidents/lib/report-stamp";
import {
  getJobAirportOptions,
  getJobsTimeZone,
} from "@/features/jobs/lib/get-job-airport-options";
import { zoneLabel } from "@/features/jobs/lib/job-time";
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

  const [jobs, airports, params] = await Promise.all([
    getIncidentJobOptions(),
    getJobAirportOptions(),
    searchParams,
  ]);
  const timeZone = getJobsTimeZone(airports, undefined);
  // Only a job the user can report on is selected first.
  const requested = typeof params.job_id === "string" ? params.job_id : "";
  const initialJobId = jobs.some((job) => job.id === requested)
    ? requested
    : "";
  const cancelHref = hasAnyPermission(user.role, INCIDENTS_ACCESS_PERMISSIONS)
    ? "/incidents"
    : "/jobs";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl leading-8 font-semibold text-primary-subtle-foreground">
        Report incident
      </h1>
      <IncidentReportForm
        jobs={jobs}
        reportedAt={formatReportStamp(new Date().toISOString(), timeZone)}
        zone={zoneLabel(timeZone)}
        initialJobId={initialJobId}
        cancelHref={cancelHref}
      />
    </div>
  );
}
