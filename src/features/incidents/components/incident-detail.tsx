import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { IncidentSeverityBadge } from "@/features/incidents/components/incident-severity-badge";
import { IncidentStatusBadge } from "@/features/incidents/components/incident-status-badge";
import type { IncidentDetailItem } from "@/features/incidents/types";

interface IncidentDetailProps {
  incident: IncidentDetailItem;
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Read-only. Changing the status is a later story (FO-F05-S06). The
 * description is free text: it is rendered as text, never as markup.
 */
export function IncidentDetail({ incident }: IncidentDetailProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Incident: {incident.type}
          </h1>
          <div className="flex items-center gap-2">
            <IncidentSeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
          </div>
        </div>
        <Link
          href="/incidents"
          className={buttonVariants({ variant: "outline" })}
        >
          Back to incidents
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Description</h2>
        <p className="max-w-prose text-sm whitespace-pre-wrap text-foreground">
          {incident.description}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-foreground">Details</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Partner">{incident.partner?.name ?? "-"}</Detail>
          <Detail label="Seat">{incident.seat?.serial_number ?? "-"}</Detail>
          <Detail label="Booking">
            {incident.booking?.booking_number ?? "-"}
          </Detail>
          <Detail label="Job">
            {incident.technician_job_id ? (
              <Link
                href={`/jobs/${incident.technician_job_id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                View job
              </Link>
            ) : (
              "-"
            )}
          </Detail>
          <Detail label="Reported by">
            {incident.reporter?.full_name ?? "-"}
          </Detail>
          <Detail label="Reported at">{formatDateTime(incident.created_at)}</Detail>
          <Detail label="Updated at">{formatDateTime(incident.updated_at)}</Detail>
          <Detail label="Resolved by">
            {incident.resolver?.full_name ?? "-"}
          </Detail>
          <Detail label="Resolved at">
            {formatDateTime(incident.resolved_at)}
          </Detail>
        </dl>
      </section>
    </div>
  );
}
