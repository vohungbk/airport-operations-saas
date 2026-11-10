import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildSeatsHref } from "@/features/seats/lib/build-seats-href";
import type { SeatsQuery } from "@/features/seats/schemas/seats-query.schema";

interface SeatsPaginationProps {
  query: SeatsQuery;
  total: number;
}

interface PageLinkProps {
  href: string | null;
  children: ReactNode;
}

function PageLink({ href, children }: PageLinkProps) {
  const linkClass = cn(
    buttonVariants({ variant: "outline" }),
    "min-h-11 w-24 rounded-lg bg-surface",
  );

  return href ? (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  ) : (
    <span
      aria-disabled="true"
      className={cn(linkClass, "pointer-events-none opacity-45")}
    >
      {children}
    </span>
  );
}

/** Server Component — plain prev/next links, no client JS. */
export function SeatsPagination({ query, total }: SeatsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  const from = (query.page - 1) * query.page_size + 1;
  const to = Math.min(query.page * query.page_size, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-2 p-4"
    >
      <p className="whitespace-pre text-sm text-text-muted">
        {`${from}–${to} of ${total}  •  Rows per page: ${query.page_size}`}
      </p>
      <div className="flex items-center gap-2">
        <PageLink
          href={
            query.page > 1
              ? buildSeatsHref(query, { page: query.page - 1 })
              : null
          }
        >
          Previous
        </PageLink>
        <PageLink
          href={
            query.page < totalPages
              ? buildSeatsHref(query, { page: query.page + 1 })
              : null
          }
        >
          Next
        </PageLink>
      </div>
    </nav>
  );
}
