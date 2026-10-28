import Link from "next/link";

import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IncidentSeverityBadge } from "@/features/incidents/components/incident-severity-badge";
import { IncidentStatusBadge } from "@/features/incidents/components/incident-status-badge";
import { formatIncidentSeat } from "@/features/incidents/lib/incident-seat";
import { buildIncidentsHref } from "@/features/incidents/lib/build-incidents-href";
import type {
  IncidentsQuery,
  IncidentsSortColumn,
} from "@/features/incidents/schemas/incidents-query.schema";
import type { IncidentListItem } from "@/features/incidents/types";

interface IncidentsTableProps {
  incidents: IncidentListItem[];
  query: IncidentsQuery;
}

const SORTABLE: Record<IncidentsSortColumn, string> = {
  created_at: "Reported",
  severity: "Severity",
  status: "Status",
};

function SortHeader({
  query,
  column,
}: {
  query: IncidentsQuery;
  column: IncidentsSortColumn;
}) {
  const isActive = query.sort === column;

  return (
    <SortableTableHead
      href={buildIncidentsHref(query, {
        sort: column,
        order: isActive && query.order === "asc" ? "desc" : "asc",
        page: 1,
      })}
      label={SORTABLE[column]}
      direction={isActive ? query.order : null}
      idleIcon
    />
  );
}

/**
 * Server Component. The link on the type is stretched over the row, so the whole row opens the incident
 * with no script and the keyboard reaches it. The description is free text: it is rendered as text and
 * cut short, never as markup. Below 640 px the table is a list of cards (UI-F06-S04, spec R10).
 */
export function IncidentsTable({ incidents, query }: IncidentsTableProps) {
  return (
    <div className="min-w-0 sm:overflow-hidden sm:rounded-lg sm:border sm:bg-card">
      <Table stacked>
        <TableHeader className="sm:bg-muted [&_th]:h-13 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted-foreground [&_th]:uppercase [&_th_a]:text-[11px] [&_th_a]:font-semibold">
          <TableRow>
            <SortHeader query={query} column="created_at" />
            <SortHeader query={query} column="severity" />
            <SortHeader query={query} column="status" />
            <TableHead>Type</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Related</TableHead>
            <TableHead>Reported by</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="sm:[&_tr]:border-0">
          {incidents.map((incident) => (
            <TableRow
              key={incident.id}
              className="relative cursor-pointer focus-within:bg-muted/50 sm:h-13"
            >
              <TableCell data-label="Reported">
                {new Date(incident.created_at).toLocaleString()}
              </TableCell>
              <TableCell data-label="Severity">
                <IncidentSeverityBadge severity={incident.severity} />
              </TableCell>
              <TableCell data-label="Status">
                <IncidentStatusBadge status={incident.status} />
              </TableCell>
              <TableCell data-label="Type" className="font-medium">
                <Link
                  href={`/incidents/${incident.id}`}
                  aria-label={`View incident ${incident.type}`}
                  className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {incident.type}
                </Link>
              </TableCell>
              <TableCell
                data-label="Description"
                className="max-w-xs truncate max-sm:max-w-none"
                title={incident.description}
              >
                {incident.description}
              </TableCell>
              <TableCell data-label="Related">
                {formatIncidentSeat(incident.seat) ??
                  incident.booking?.booking_number ??
                  "—"}
              </TableCell>
              <TableCell data-label="Reported by">
                {incident.reporter?.full_name ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
