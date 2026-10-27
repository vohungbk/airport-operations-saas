import { TextLink } from "@/components/ui/text-link";
import {
  SortableTableHead,
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
    <Table stacked>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map((column) => (
            <SortableTableHead
              key={column.key}
              href={buildSortHref(query, column.key)}
              label={column.label}
              direction={query.sort === column.key ? query.order : null}
            />
          ))}
          <TableHead>Timezone</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {airports.map((airport) => (
          <TableRow key={airport.id}>
            <TableCell data-label="Code" className="font-medium">
              {airport.code}
            </TableCell>
            <TableCell data-label="Name">{airport.name}</TableCell>
            <TableCell data-label="City">{airport.city}</TableCell>
            <TableCell data-label="Country">{airport.country}</TableCell>
            <TableCell data-label="Timezone">{airport.timezone}</TableCell>
            <TableCell data-label="Actions" className="text-right">
              <TextLink href={`/airports/${airport.id}`} aria-label={`View airport ${airport.code}`}>
                View
              </TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
