import { PageEmpty } from "@/components/shared/page-state";
import { Pagination } from "@/components/ui/pagination";
import { SettlementsTable } from "@/features/settlements/components/settlements-table";
import type { SettlementRow } from "@/features/settlements/lib/get-settlements";
import {
  SETTLEMENTS_PAGE_SIZE,
  buildSettlementsHref,
  isSettlementsFiltered,
  type SettlementsQuery,
} from "@/features/settlements/schemas/settlements-query.schema";

interface SettlementsRegisterProps {
  settlements: SettlementRow[];
  total: number;
  query: SettlementsQuery;
}

/** "Showing 1–3 of 3 settlements"; the numbers of the page the list is on. */
function showingText(page: number, total: number): string {
  const from = (page - 1) * SETTLEMENTS_PAGE_SIZE + 1;
  const to = Math.min(page * SETTLEMENTS_PAGE_SIZE, total);

  return `Showing ${from}–${to} of ${total} ${total === 1 ? "settlement" : "settlements"}`;
}

/**
 * The "Settlement register" card of the design: its title and count, the note about the amounts, the
 * table and the pagination. An empty list says whether nothing matches the filters or nothing exists.
 */
export function SettlementsRegister({ settlements, total, query }: SettlementsRegisterProps) {
  const totalPages = Math.max(1, Math.ceil(total / SETTLEMENTS_PAGE_SIZE));

  return (
    <section aria-labelledby="settlements-heading" className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline gap-3 px-6 py-5">
        <h2 id="settlements-heading" className="text-base font-semibold text-foreground">
          Settlement register
        </h2>
        <span className="text-xs text-muted-foreground">
          {total} {total === 1 ? "settlement" : "settlements"}
        </span>
      </div>

      {total === 0 ? (
        <div className="px-6 pb-6">
          <PageEmpty
            message={isSettlementsFiltered(query) ? "No settlements match the filters." : "No settlements yet."}
          />
        </div>
      ) : (
        <>
          <p className="bg-muted px-6 py-3 text-xs text-muted-foreground">
            All amounts in USD · Select a row to view the full breakdown.
          </p>
          <div className="px-3">
            <SettlementsTable settlements={settlements} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
            <p className="text-xs text-muted-foreground">{showingText(query.page, total)}</p>
            <Pagination
              page={query.page}
              totalPages={totalPages}
              buildHref={(page) => buildSettlementsHref(query, { page })}
              className="justify-end"
            />
          </div>
        </>
      )}
    </section>
  );
}
