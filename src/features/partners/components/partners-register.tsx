import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { PartnersRowsPerPage } from "@/features/partners/components/partners-rows-per-page";
import { PartnersStateCard } from "@/features/partners/components/partners-state-card";
import { PartnersTable } from "@/features/partners/components/partners-table";
import {
  buildPartnersHref,
  isPartnersFiltered,
} from "@/features/partners/lib/build-partners-href";
import type { PartnersQuery } from "@/features/partners/schemas/partners-query.schema";
import type { Partner } from "@/features/partners/types";

interface PartnersRegisterProps {
  partners: Partner[];
  total: number;
  query: PartnersQuery;
}

/** "Showing 1–8 of 24 partners"; the numbers of the page the list is on. */
function showingText(query: PartnersQuery, total: number): string {
  const from = (query.page - 1) * query.page_size + 1;
  const to = Math.min(query.page * query.page_size, total);

  return `Showing ${from}–${to} of ${total} ${total === 1 ? "partner" : "partners"}`;
}

/**
 * The list under the search: the table with its footer, or, with nothing to show, the state that says
 * whether no partner exists yet or none matches the search.
 */
export function PartnersRegister({ partners, total, query }: PartnersRegisterProps) {
  if (total === 0) {
    return isPartnersFiltered(query) ? (
      <PartnersStateCard
        title="No partners match your search"
        description="Try another code, name or contact."
      >
        <Link
          href="/partners"
          className={buttonVariants({ className: "min-h-11 px-4" })}
        >
          Clear search
        </Link>
      </PartnersStateCard>
    ) : (
      <PartnersStateCard
        title="No partners yet"
        description="Create your first partner to start building your rental network."
      >
        <Link
          href="/partners/new"
          className={buttonVariants({ className: "min-h-11 px-4" })}
        >
          Create partner
        </Link>
      </PartnersStateCard>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / query.page_size));

  return (
    <section
      aria-label="Partners"
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <PartnersTable partners={partners} />
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-muted-foreground">{showingText(query, total)}</p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <Pagination
            page={query.page}
            totalPages={totalPages}
            buildHref={(page) => buildPartnersHref(query, { page })}
            labelled
            className="justify-start sm:justify-end"
          />
          <PartnersRowsPerPage query={query} />
        </div>
      </div>
    </section>
  );
}
