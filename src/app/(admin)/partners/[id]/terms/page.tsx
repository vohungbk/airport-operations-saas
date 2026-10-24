import Link from "next/link";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { CommercialTermsHistory } from "@/features/partners/components/commercial-terms-history";
import { CommercialTermsForm } from "@/features/partners/components/commercial-terms-form";
import { CommercialTermsSummary } from "@/features/partners/components/commercial-terms-summary";
import {
  defaultCommercialTermsFormValues,
  pickCommercialTerms,
  utcToday,
} from "@/features/partners/lib/commercial-terms";
import { COMMERCIAL_TERMS_LIMIT, getCommercialTerms } from "@/features/partners/lib/get-commercial-terms";
import { getPartnerById } from "@/features/partners/lib/get-partner-by-id";

interface CommercialTermsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * VI-F04-S01 and S03: set and review the commercial terms of a partner, and read the earlier ones. Admin and operations manager
 * open it (`partners:manage`); only an admin gets the form (spec Q1 is open), the operations
 * manager reads. The save checks the role again on the server and in the database. An unknown
 * partner is not found.
 */
export default async function CommercialTermsPage({ params }: CommercialTermsPageProps) {
  const user = await requirePermission("partners:manage");

  const { id } = await params;
  const partner = await getPartnerById(id);

  if (!partner) {
    notFound();
  }

  const today = utcToday();
  const { versions, truncated } = await getCommercialTerms(partner.id);
  const terms = pickCommercialTerms(versions, today);
  const canEdit = user.role === "admin";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Commercial terms</h1>
          <p className="text-sm text-muted-foreground">
            {partner.name} ({partner.code})
          </p>
        </div>
        <Link href={`/partners/${partner.id}`} className={buttonVariants({ variant: "outline" })}>
          Back to partner
        </Link>
      </div>

      <CommercialTermsSummary terms={terms} />

      {canEdit ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-foreground">Set new terms</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Saving adds new terms from the effective date. Earlier terms are kept, and rentals that are
            already completed keep the terms they were calculated with.
          </p>
          <CommercialTermsForm
            partnerId={partner.id}
            today={today}
            defaultValues={defaultCommercialTermsFormValues(versions, today)}
          />
        </section>
      ) : (
        <Alert>
          <AlertTitle>Read only</AlertTitle>
          <AlertDescription>Only an admin can change commercial terms.</AlertDescription>
        </Alert>
      )}

      <CommercialTermsHistory earlier={terms.earlier} truncated={truncated} limit={COMMERCIAL_TERMS_LIMIT} />
    </div>
  );
}
