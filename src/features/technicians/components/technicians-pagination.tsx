import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildTechniciansHref } from "@/features/technicians/lib/build-technicians-href";
import type { TechniciansQuery } from "@/features/technicians/schemas/technicians-query.schema";

interface TechniciansPaginationProps {
  query: TechniciansQuery;
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

export function TechniciansPagination({
  query,
  total,
}: TechniciansPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  const from = (query.page - 1) * query.page_size + 1;
  const to = Math.min(query.page * query.page_size, total);

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-muted p-4">
      <p className="whitespace-pre text-sm text-text-muted">
        {`${from}–${to} of ${total}  •  Rows per page: ${query.page_size}`}
      </p>
      <div className="flex items-center gap-2">
        <PageLink
          href={
            query.page > 1
              ? buildTechniciansHref(query, { page: query.page - 1 })
              : null
          }
        >
          Previous
        </PageLink>
        <PageLink
          href={
            query.page < totalPages
              ? buildTechniciansHref(query, { page: query.page + 1 })
              : null
          }
        >
          Next
        </PageLink>
      </div>
    </div>
  );
}
