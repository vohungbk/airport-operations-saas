import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
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
import { formatIncidentSeat } from "@/features/incidents/lib/incident-seat";
import { formatReportedAt } from "@/features/incidents/lib/incident-time";
import type { IncidentListItem } from "@/features/incidents/types";

interface IncidentsTableProps {
  incidents: IncidentListItem[];
  /** The zone the reported time is written in. */
  timeZone: string;
}

const HEAD_CLASS =
  "h-auto px-0 py-0 py-3 pr-4 text-xs font-semibold leading-4 text-text-muted";
const CELL_CLASS =
  "py-3 pr-4 text-sm leading-5 whitespace-normal break-words text-foreground";

/**
 * Server Component. Columns of the design: incident, seat, booking, severity,
 * status, reported by, reported at and a View action. Below 640 px the table
 * is a list of cards; from 640 px up it is the table. The incident type is
 * free text: it is rendered as text, never as markup.
 */
export function IncidentsTable({ incidents, timeZone }: IncidentsTableProps) {
  return (
    <Table stacked>
      <TableHeader className="bg-surface-muted [&_tr]:border-b">
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD_CLASS} pl-4`}>Incident</TableHead>
          <TableHead className={HEAD_CLASS}>Seat</TableHead>
          <TableHead className={HEAD_CLASS}>Booking</TableHead>
          <TableHead className={HEAD_CLASS}>Severity</TableHead>
          <TableHead className={HEAD_CLASS}>Status</TableHead>
          <TableHead className={HEAD_CLASS}>Reported by</TableHead>
          <TableHead className={HEAD_CLASS}>Reported at</TableHead>
          <TableHead className={HEAD_CLASS}>Row action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {incidents.map((incident) => (
          <TableRow
            key={incident.id}
            className="transition-colors hover:bg-primary-subtle"
          >
            <TableCell
              data-label="Incident"
              className={`${CELL_CLASS} pl-4 font-medium`}
            >
              <Link
                href={`/incidents/${incident.id}`}
                className="hover:underline"
              >
                {incident.type}
              </Link>
            </TableCell>
            <TableCell data-label="Seat" className={CELL_CLASS}>
              {formatIncidentSeat(incident.seat) ?? "—"}
            </TableCell>
            <TableCell data-label="Booking" className={CELL_CLASS}>
              {incident.booking?.booking_number ?? "—"}
            </TableCell>
            <TableCell data-label="Severity" className={CELL_CLASS}>
              <IncidentSeverityBadge severity={incident.severity} />
            </TableCell>
            <TableCell data-label="Status" className={CELL_CLASS}>
              <IncidentStatusBadge status={incident.status} />
            </TableCell>
            <TableCell data-label="Reported by" className={CELL_CLASS}>
              {incident.reporter?.full_name ?? "—"}
            </TableCell>
            <TableCell data-label="Reported at" className={CELL_CLASS}>
              {formatReportedAt(incident.created_at, timeZone)}
            </TableCell>
            <TableCell data-label="Row action" className={CELL_CLASS}>
              <Link
                href={`/incidents/${incident.id}`}
                aria-label={`View incident ${incident.type}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "min-h-11 rounded-lg bg-surface px-4",
                })}
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
