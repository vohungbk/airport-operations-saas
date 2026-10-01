import Link from "next/link";

import { requirePermission } from "@/lib/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import { getSeatCategories } from "@/features/seat-categories/lib/get-seat-categories";
import { seatCategoriesQuerySchema } from "@/features/seat-categories/schemas/seat-categories-query.schema";
import { SeatCategoriesFilters } from "@/features/seat-categories/components/seat-categories-filters";
import { SeatCategoriesPagination } from "@/features/seat-categories/components/seat-categories-pagination";
import { SeatCategoriesTable } from "@/features/seat-categories/components/seat-categories-table";

interface SeatCategoriesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second `requirePermission` call alongside the layout's —
 * same defense-in-depth precedent as `partners/page.tsx`.
 */
export default async function SeatCategoriesPage({
  searchParams,
}: SeatCategoriesPageProps) {
  await requirePermission("seat_categories:manage");

  const rawParams = await searchParams;
  const requestedQuery = seatCategoriesQuerySchema.parse(rawParams);
  const { seatCategories, total, page } =
    await getSeatCategories(requestedQuery);
  // An out-of-range page is served as the last valid page.
  const query = { ...requestedQuery, page };

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Seat Categories
        </h1>
        <Link href="/seat-categories/new" className={buttonVariants()}>
          Add Seat Category
        </Link>
      </div>

      <SeatCategoriesFilters
        q={query.q}
        status={query.status}
        sort={query.sort}
        order={query.order}
      />

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No seat categories found. Try adjusting the search or filter, or add
          a new seat category.
        </p>
      ) : (
        <>
          <SeatCategoriesTable seatCategories={seatCategories} query={query} />
          <SeatCategoriesPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
