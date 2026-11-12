import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildIncidentsHref } from "@/features/incidents/lib/build-incidents-href";
import {
  INCIDENT_STATUS_LABEL,
  type IncidentStatus,
} from "@/features/incidents/lib/incident-status";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

interface IncidentsStatusChipsProps {
  query: IncidentsQuery;
}

const CHIPS: readonly { label: string; status: IncidentStatus | undefined }[] =
  [
    { label: "All", status: undefined },
    ...(["open", "investigating", "resolved"] as const).map((status) => ({
      label: INCIDENT_STATUS_LABEL[status],
      status,
    })),
  ];

/**
 * The chips of the design above the table: All, Open, Investigating and
 * Resolved. Links, so the filter is in the address and needs no script.
 * Changing the chip goes back to page 1.
 */
export function IncidentsStatusChips({ query }: IncidentsStatusChipsProps) {
  return (
    <nav
      aria-label="Status"
      className="flex w-fit max-w-full flex-wrap gap-3 rounded-lg border border-border bg-surface p-4"
    >
      {CHIPS.map(({ label, status }) => {
        const active = query.status === status;

        return (
          <Link
            key={label}
            href={buildIncidentsHref(query, { status, page: 1 })}
            aria-current={active ? "page" : undefined}
            className={buttonVariants({
              variant: active ? "default" : "outline",
              className: "min-h-11 rounded-lg px-4",
            })}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
