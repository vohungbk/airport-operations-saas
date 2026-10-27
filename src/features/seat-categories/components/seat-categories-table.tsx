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
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {seatCategories.map((seatCategory) => (
          <TableRow key={seatCategory.id}>
            <TableCell data-label="Name" className="font-medium">
              {seatCategory.name}
            </TableCell>
            <TableCell data-label="Min age">{seatCategory.min_child_age} months</TableCell>
            <TableCell data-label="Max age">{seatCategory.max_child_age} months</TableCell>
            <TableCell data-label="Safety standard">{seatCategory.safety_standard}</TableCell>
            <TableCell data-label="Status">
              <SeatCategoryStatusBadge isActive={seatCategory.is_active} />
            </TableCell>
            <TableCell data-label="Actions" className="text-right">
              <TextLink
                href={`/seat-categories/${seatCategory.id}`}
                aria-label={`View ${seatCategory.name} (${formatAgeRange(seatCategory.min_child_age, seatCategory.max_child_age)})`}
              >
                View
              </TextLink>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
