import { Info } from "lucide-react";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import { CommercialTermsForm } from "@/features/partners/components/commercial-terms-form";
import { CommercialTermsHistory } from "@/features/partners/components/commercial-terms-history";
import { CommercialTermsLaunchCredit } from "@/features/partners/components/commercial-terms-launch-credit";
import {
  COMMERCIAL_TERMS_FORM_ID,
  buildTermsHistory,
  defaultCommercialTermsFormValues,
  launchCreditProgress,
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
 * open it (`partners:manage`); only an admin can save (spec Q1 is open), the operations manager reads
 * the same layout with the fields off. The save checks the role again on the server and in the
 * database. An unknown partner is not found.
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
  const { current } = pickCommercialTerms(versions, today);
  const { rows, currentLabel } = buildTermsHistory(versions, today);
  const progress = launchCreditProgress(current);
  const canEdit = user.role === "admin";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Commercial terms</h1>
          <p className="text-sm text-muted-foreground">
            {[partner.name, "Internal only", currentLabel ? `Terms ${currentLabel}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {canEdit && (
          <Button type="submit" form={COMMERCIAL_TERMS_FORM_ID} className="min-h-11 px-4">
            Save new terms version
          </Button>
        )}
      </div>

      <p className="flex items-center gap-2 rounded-lg bg-info-bg px-4 py-3 text-xs text-info-fg">
        <Info aria-hidden="true" className="size-4 shrink-0" />
        New terms apply from the effective date. Completed rentals keep their earlier terms.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <CommercialTermsForm
          partnerId={partner.id}
          today={today}
          defaultValues={defaultCommercialTermsFormValues(versions, today)}
          canEdit={canEdit}
        />
        <div className="flex flex-col gap-6">
          {progress && <CommercialTermsLaunchCredit progress={progress} />}
          <CommercialTermsHistory
            rows={rows}
            currentLabel={currentLabel}
            truncated={truncated}
            limit={COMMERCIAL_TERMS_LIMIT}
          />
        </div>
      </div>
    </div>
  );
}
