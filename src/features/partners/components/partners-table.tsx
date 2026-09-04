import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PartnerStatusBadge } from "@/features/partners/components/partner-status-badge";
import type { Partner } from "@/features/partners/types";
import type {
  PartnersQuery,
  PartnersSortColumn,
} from "@/features/partners/schemas/partners-query.schema";

interface PartnersTableProps {
  partners: Partner[];
  query: PartnersQuery;
}

const SORTABLE_COLUMNS: { key: PartnersSortColumn; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "code", label: "Code" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Created" },
];

function buildSortHref(query: PartnersQuery, column: PartnersSortColumn): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  params.set("sort", column);
  params.set(
    "order",
    query.sort === column && query.order === "asc" ? "desc" : "asc",
  );
  return `/partners?${params.toString()}`;
}

/**
 * Server Component — sorting is plain `<Link>` navigation (new
 * `searchParams`, re-rendered server-side), no client JS needed. The
 * "active bookings" column is a static, explicitly-labeled placeholder
 * (never `0` or a live query) — Booking Management doesn't exist yet
 * (F11), and a blank/zero value here would look like real data instead
 * of "not built."
 */
export function PartnersTable({ partners, query }: PartnersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map((column) => (
            <TableHead key={column.key}>
              <Link
                href={buildSortHref(query, column.key)}
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
          <TableHead>Contact email</TableHead>
          <TableHead>Active bookings</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {partners.map((partner) => (
          <TableRow key={partner.id}>
            <TableCell className="font-medium">{partner.name}</TableCell>
            <TableCell>{partner.code}</TableCell>
            <TableCell>
              <PartnerStatusBadge status={partner.status} />
            </TableCell>
            <TableCell>
              {new Date(partner.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>{partner.contact_email}</TableCell>
            <TableCell
              className="text-sm text-muted-foreground"
              title="Available once Booking Management (F11) ships"
            >
              Not available yet
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/partners/${partner.id}`}
                className="text-primary underline-offset-4 hover:underline"
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
