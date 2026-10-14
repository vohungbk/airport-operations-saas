import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildTechniciansHref } from "@/features/technicians/lib/build-technicians-href";
import { TechnicianStatusBadge } from "@/features/technicians/components/technician-status-badge";
import type { Technician } from "@/features/technicians/types";
import type {
  TechniciansQuery,
  TechniciansSortColumn,
} from "@/features/technicians/schemas/technicians-query.schema";

interface TechniciansTableProps {
  technicians: Technician[];
  query: TechniciansQuery;
}

const SORTABLE_COLUMNS: { key: TechniciansSortColumn; label: string }[] = [
  { key: "full_name", label: "Name" },
  { key: "email", label: "Email" },
];

/**
 * Server Component — sorting is plain `<Link>` navigation. The name cell
 * links to the detail page so a row can be opened from the keyboard.
 */
export function TechniciansTable({ technicians, query }: TechniciansTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map((column) => (
            <TableHead key={column.key}>
              <Link
                href={buildTechniciansHref(query, {
                  sort: column.key,
                  order:
                    query.sort === column.key && query.order === "asc"
                      ? "desc"
                      : "asc",
                  page: 1,
                })}
                className="flex items-center gap-1 hover:text-foreground"
              >
                {column.label}
                {query.sort === column.key && (
                  <span aria-hidden="true">
                    {query.order === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </Link>
            </TableHead>
          ))}
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {technicians.map((technician) => (
          <TableRow key={technician.id}>
            <TableCell className="font-medium">
              <Link
                href={`/technicians/${technician.id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {technician.full_name}
              </Link>
            </TableCell>
            <TableCell>{technician.email}</TableCell>
            <TableCell>
              <TechnicianStatusBadge is_active={technician.is_active} />
            </TableCell>
            <TableCell>
              {new Date(technician.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
