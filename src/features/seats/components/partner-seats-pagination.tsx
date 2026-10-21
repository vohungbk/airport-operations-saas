import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildPartnerSeatsHref } from "@/features/seats/lib/build-partner-seats-href";
import type { PartnerSeatsQuery } from "@/features/seats/schemas/partner-seats-query.schema";

interface PartnerSeatsPaginationProps {
  query: PartnerSeatsQuery;
  total: number;
}

/** Server Component: plain prev/next links, no client JS. */
export function PartnerSeatsPagination({
  query,
  total,
}: PartnerSeatsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  const linkClass = buttonVariants({ variant: "outline", size: "sm" });
  const steps = [
    { label: "Previous", page: query.page - 1, enabled: query.page > 1 },
    { label: "Next", page: query.page + 1, enabled: query.page < totalPages },
  ];

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-2"
    >
      <p className="text-sm text-muted-foreground">
        Page {query.page} of {totalPages} ({total} seat
        {total === 1 ? "" : "s"})
      </p>
      <div className="flex items-center gap-2">
        {steps.map((step) =>
          step.enabled ? (
            <Link
              key={step.label}
              href={buildPartnerSeatsHref(query, { page: step.page })}
              className={linkClass}
            >
              {step.label}
            </Link>
          ) : (
            <span
              key={step.label}
              aria-disabled="true"
              className={cn(linkClass, "pointer-events-none opacity-50")}
            >
              {step.label}
            </span>
          ),
        )}
      </div>
    </nav>
  );
}
