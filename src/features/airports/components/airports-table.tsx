import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Airport } from "@/features/airports/types";
import type {
  AirportsQuery,
  AirportsSortColumn,
} from "@/features/airports/schemas/airports-query.schema";

interface AirportsTableProps {
  airports: Airport[];
  query: AirportsQuery;
}

const SORTABLE_COLUMNS: { key: AirportsSortColumn; label: string }[] = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
];

function buildSortHref(query: AirportsQuery, column: AirportsSortColumn): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  params.set("sort", column);
  params.set(
    "order",
    query.sort === column && query.order === "asc" ? "desc" : "asc",
  );
  return `/airports?${params.toString()}`;
}

/**
 * Server Component — sorting is plain `<Link>` navigation (new
 * `searchParams`, re-rendered server-side), no client JS needed. Mirrors
 * `partners-table.tsx` but with no "Active bookings" placeholder column —
 * `airports` has no equivalent field.
 */
export function AirportsTable({ airports, query }: AirportsTableProps) {
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
          <TableHead>Timezone</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {airports.map((airport) => (
          <TableRow key={airport.id}>
            <TableCell className="font-medium">{airport.code}</TableCell>
            <TableCell>{airport.name}</TableCell>
            <TableCell>{airport.city}</TableCell>
            <TableCell>{airport.country}</TableCell>
            <TableCell>{airport.timezone}</TableCell>
            <TableCell className="text-right">
              <Link
                href={`/airports/${airport.id}`}
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
