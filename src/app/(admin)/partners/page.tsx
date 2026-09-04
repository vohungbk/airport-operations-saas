import Link from "next/link";

import { requirePermission } from "@/lib/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import { getPartners } from "@/features/partners/lib/get-partners";
import { partnersQuerySchema } from "@/features/partners/schemas/partners-query.schema";
import { PartnersFilters } from "@/features/partners/components/partners-filters";
import { PartnersPagination } from "@/features/partners/components/partners-pagination";
import { PartnersTable } from "@/features/partners/components/partners-table";

interface PartnersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Independent second `requirePermission` call alongside the layout's —
 * same defense-in-depth precedent as F04's `(admin)/admin` route (see
 * `docs/security.md`).
 */
export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  await requirePermission("partners:manage");

  const rawParams = await searchParams;
  const query = partnersQuerySchema.parse(rawParams);
  const { partners, total } = await getPartners(query);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Partners
        </h1>
        <Link href="/partners/new" className={buttonVariants()}>
          Add Partner
        </Link>
      </div>

      <PartnersFilters
        q={query.q}
        status={query.status}
        sort={query.sort}
        order={query.order}
      />

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No partners found. Try adjusting the search or filters, or add a
          new partner.
        </p>
      ) : (
        <>
          <PartnersTable partners={partners} query={query} />
          <PartnersPagination query={query} total={total} />
        </>
      )}
    </div>
  );
}
