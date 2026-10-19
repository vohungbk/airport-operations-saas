import Link from "next/link";

import { requireAnyPermission } from "@/lib/auth/current-user";
import { INCIDENTS_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";
import { buttonVariants } from "@/components/ui/button";
import { PageForbidden } from "@/components/shared/page-state";
import { IncidentDetail } from "@/features/incidents/components/incident-detail";
import { getIncidentById } from "@/features/incidents/lib/get-incident-by-id";

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
  await requireAnyPermission(INCIDENTS_ACCESS_PERMISSIONS);

  const { id } = await params;
  const incident = await getIncidentById(id);

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

  return <IncidentDetail incident={incident} />;
}
