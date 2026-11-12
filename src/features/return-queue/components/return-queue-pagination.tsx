import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildReturnQueueHref } from "@/features/return-queue/lib/build-return-queue-href";
import type { ReturnQueueQuery } from "@/features/return-queue/schemas/return-queue-query.schema";

interface ReturnQueuePaginationProps {
  query: ReturnQueueQuery;
  total: number;
}

function PageLink({ href, children }: { href: string | null; children: ReactNode }) {
  const linkClass = cn(
    buttonVariants({ variant: "outline" }),
    "min-h-11 w-24 rounded-lg bg-surface text-sm",
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

/** `1-3 of 3` with Previous and Next, as in the design. */
export function ReturnQueuePagination({ query, total }: ReturnQueuePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  const last = Math.min(query.page * query.page_size, total);
  // An out-of-range page still says a range that exists.
  const first = Math.min((query.page - 1) * query.page_size + 1, last);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-2 p-4"
    >
      <p className="text-sm text-text-muted">{`${first}-${last} of ${total}`}</p>
      <div className="flex items-center gap-2">
        <PageLink
          href={
            query.page > 1
              ? buildReturnQueueHref(query, { page: query.page - 1 })
              : null
          }
        >
          Previous
        </PageLink>
        <PageLink
          href={
            query.page < totalPages
              ? buildReturnQueueHref(query, { page: query.page + 1 })
              : null
          }
        >
          Next
        </PageLink>
      </div>
    </nav>
  );
}
