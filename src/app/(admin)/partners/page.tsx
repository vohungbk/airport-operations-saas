import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { getPartners } from "@/features/partners/lib/get-partners";
import { buildPartnersHref } from "@/features/partners/lib/build-partners-href";
import { partnersQuerySchema } from "@/features/partners/schemas/partners-query.schema";
import { PartnersPageHeader } from "@/features/partners/components/partners-page-header";
import { PartnersRegister } from "@/features/partners/components/partners-register";
import { PartnersSearch } from "@/features/partners/components/partners-search";

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

  // A page past the last one goes to the last page instead of showing an empty table.
  const totalPages = Math.max(1, Math.ceil(total / query.page_size));
  if (total > 0 && query.page > totalPages) {
    redirect(buildPartnersHref(query, { page: totalPages }));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <PartnersPageHeader />

      <PartnersSearch key={query.q ?? ""} query={query} />

      <PartnersRegister partners={partners} total={total} query={query} />
    </div>
  );
}
