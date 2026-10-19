import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IncidentSeverityBadge } from "@/features/incidents/components/incident-severity-badge";
import { IncidentStatusBadge } from "@/features/incidents/components/incident-status-badge";
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
  return (
    <TableHead>
      <Link
        href={buildIncidentsHref(query, {
          sort: column,
          order: query.sort === column && query.order === "asc" ? "desc" : "asc",
          page: 1,
        })}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {SORTABLE[column]}
        {query.sort === column && (
          <span aria-hidden="true">{query.order === "asc" ? "↑" : "↓"}</span>
        )}
      </Link>
    </TableHead>
  );
}

/**
 * Server Component. The type links to the incident detail, so a row can be
 * opened from the keyboard. The description is free text: it is rendered as
 * text and cut short, never as markup.
 */
export function IncidentsTable({ incidents, query }: IncidentsTableProps) {
  return (
    <Table>
      <TableHeader>
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
      <TableBody>
        {incidents.map((incident) => (
          <TableRow key={incident.id}>
            <TableCell>
              {new Date(incident.created_at).toLocaleString()}
            </TableCell>
            <TableCell>
              <IncidentSeverityBadge severity={incident.severity} />
            </TableCell>
            <TableCell>
              <IncidentStatusBadge status={incident.status} />
            </TableCell>
            <TableCell className="font-medium">
              <Link
                href={`/incidents/${incident.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {incident.type}
              </Link>
            </TableCell>
            <TableCell className="max-w-xs truncate" title={incident.description}>
              {incident.description}
            </TableCell>
            <TableCell>
              {incident.seat?.serial_number ??
                incident.booking?.booking_number ??
                "—"}
            </TableCell>
            <TableCell>{incident.reporter?.full_name ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
