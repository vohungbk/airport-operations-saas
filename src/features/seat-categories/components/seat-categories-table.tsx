import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeatCategoryStatusBadge } from "@/features/seat-categories/components/seat-category-status-badge";
import { formatAgeRange } from "@/features/seat-categories/lib/format-age-range";
import type {
  SeatCategoriesQuery,
  SeatCategoriesSortColumn,
} from "@/features/seat-categories/schemas/seat-categories-query.schema";
import type { SeatCategory } from "@/features/seat-categories/types";

interface SeatCategoriesTableProps {
  seatCategories: SeatCategory[];
  query: SeatCategoriesQuery;
}

const SORTABLE_COLUMNS: { key: SeatCategoriesSortColumn; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "min_child_age", label: "Min age" },
  { key: "max_child_age", label: "Max age" },
  { key: "safety_standard", label: "Safety standard" },
];

function buildSortHref(
  query: SeatCategoriesQuery,
  column: SeatCategoriesSortColumn,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  params.set("sort", column);
  params.set(
    "order",
    query.sort === column && query.order === "asc" ? "desc" : "asc",
  );
  return `/seat-categories?${params.toString()}`;
}

/**
 * Server Component — sorting is plain `<Link>` navigation. Min/max age
 * are shown as one range column; the sort links stay per-column.
 */
export function SeatCategoriesTable({
  seatCategories,
  query,
}: SeatCategoriesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {SORTABLE_COLUMNS.map((column) => (
            <TableHead
              key={column.key}
              aria-sort={
                query.sort === column.key
                  ? query.order === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
            >
              <Link
                href={buildSortHref(query, column.key)}
                className="flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {seatCategories.map((seatCategory) => (
          <TableRow key={seatCategory.id}>
            <TableCell className="font-medium">{seatCategory.name}</TableCell>
            <TableCell>{seatCategory.min_child_age} months</TableCell>
            <TableCell>{seatCategory.max_child_age} months</TableCell>
            <TableCell>{seatCategory.safety_standard}</TableCell>
            <TableCell>
              <SeatCategoryStatusBadge isActive={seatCategory.is_active} />
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/seat-categories/${seatCategory.id}`}
                aria-label={`View ${seatCategory.name} (${formatAgeRange(seatCategory.min_child_age, seatCategory.max_child_age)})`}
                className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
