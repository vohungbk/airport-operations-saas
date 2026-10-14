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
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });

  return href ? (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  ) : (
    <span className={cn(linkClass, "pointer-events-none opacity-50")}>
      {children}
    </span>
  );
}

export function TechniciansPagination({
  query,
  total,
}: TechniciansPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Page {query.page} of {totalPages} ({total} technician
        {total === 1 ? "" : "s"})
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
