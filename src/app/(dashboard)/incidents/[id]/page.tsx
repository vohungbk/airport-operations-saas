import Link from "next/link";

import { requireAnyPermission } from "@/lib/auth/current-user";
import {
  INCIDENTS_ACCESS_PERMISSIONS,
  INCIDENT_STATUS_UPDATE_PERMISSIONS,
  hasAnyPermission,
} from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageForbidden } from "@/components/shared/page-state";
import { IncidentDetail } from "@/features/incidents/components/incident-detail";
import { getIncidentById } from "@/features/incidents/lib/get-incident-by-id";
import { getIncidentHistory } from "@/features/incidents/lib/get-incident-history";
import { getAllowedIncidentTransitions } from "@/features/incidents/lib/incident-status";
import {
  getJobAirportOptions,
  getJobsTimeZone,
} from "@/features/jobs/lib/get-job-airport-options";
import { ROLE_LABELS } from "@/lib/auth/role-labels";

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Independent second guard alongside the layout's. RLS scopes the row: an
 * incident the user cannot read comes back as `null`, the same as a missing
 * or malformed id, so the forbidden state does not say which of the three it
 * is.
 */
export default async function IncidentDetailPage({
  params,
}: IncidentDetailPageProps) {
  const user = await requireAnyPermission(INCIDENTS_ACCESS_PERMISSIONS);

  const { id } = await params;
  // Only managers change a status and read the history; nobody else needs
  // the query.
  const isManager = hasAnyPermission(
    user.role,
    INCIDENT_STATUS_UPDATE_PERMISSIONS,
  );
  const [incident, historyResult, airports] = await Promise.all([
    getIncidentById(id),
    isManager ? getIncidentHistory(id) : Promise.resolve(null),
    getJobAirportOptions(),
  ]);

  if (!incident) {
    return (
      <PageForbidden
        title="You cannot view this incident"
        description="This incident was not found or is not within your access."
      >
        <Link
          href="/incidents"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to incidents
        </Link>
      </PageForbidden>
    );
  }

  // The control is hidden when the user has no permitted transition; the
  // database function enforces the same rules.
  const allowedStatuses = isManager
    ? getAllowedIncidentTransitions(incident.status)
    : [];

  // The booking's airport, else the zone every airport shares, as on the list.
  const timeZone =
    incident.booking?.airport?.timezone ?? getJobsTimeZone(airports, undefined);

  return (
    <IncidentDetail
      incident={incident}
      history={historyResult?.history ?? null}
      historyTruncated={historyResult?.truncated ?? false}
      // Staff names are internal: a partner user does not see them.
      showStaffDetails={user.role !== "partner_user"}
      showJobLink={user.role === "technician"}
      allowedStatuses={allowedStatuses}
      accessLabel={isManager ? `${ROLE_LABELS[user.role]} - Full access` : null}
      timeZone={timeZone}
    />
  );
}
