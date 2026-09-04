import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PartnersQuery } from "@/features/partners/schemas/partners-query.schema";

interface PartnersPaginationProps {
  query: PartnersQuery;
  total: number;
}

function buildPageHref(query: PartnersQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("page", String(page));
  params.set("page_size", String(query.page_size));
  return `/partners?${params.toString()}`;
}

/**
 * Server Component — plain prev/next `<Link>`s, no client JS needed for
 * pagination (per `frontend.md`: a Server Component re-renders from new
 * `searchParams` on its own).
 */
export function PartnersPagination({ query, total }: PartnersPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  const hasPrev = query.page > 1;
  const hasNext = query.page < totalPages;
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Page {query.page} of {totalPages} ({total} partner
        {total === 1 ? "" : "s"})
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Link href={buildPageHref(query, query.page - 1)} className={linkClass}>
            Previous
          </Link>
        ) : (
          <span className={cn(linkClass, "pointer-events-none opacity-50")}>
            Previous
          </span>
        )}
        {hasNext ? (
          <Link href={buildPageHref(query, query.page + 1)} className={linkClass}>
            Next
          </Link>
        ) : (
          <span className={cn(linkClass, "pointer-events-none opacity-50")}>
            Next
          </span>
        )}
      </div>
    </div>
  );
}
