import type { ReactNode } from "react";

import type { CommercialTermsVersion, PickedCommercialTerms } from "@/features/partners/lib/commercial-terms";

interface CommercialTermsSummaryProps {
  terms: PickedCommercialTerms;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function TermsCard({ title, version }: { title: string; version: CommercialTermsVersion }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Detail label="Launch credit target">
          {version.launch_credit_target === null ? "None" : version.launch_credit_target}
        </Detail>
        <Detail label="Annual programme fee">{version.annual_fee}</Detail>
        <Detail label="Onboarding credit">{version.onboarding_fee}</Detail>
        <Detail label="VAT rate">{version.vat_rate_percent}%</Detail>
        <Detail label="Payment terms">{version.payment_terms_days} days</Detail>
        <div>
          <dt className="text-sm text-muted-foreground">Partner share</dt>
          <dd className="mt-1 text-sm text-foreground">{version.partner_share_percent}%</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Platform share</dt>
          <dd className="mt-1 text-sm text-foreground">{version.platform_share_percent}%</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Launch partner share</dt>
          <dd className="mt-1 text-sm text-foreground">{version.launch_partner_share_percent}%</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Effective from</dt>
          <dd className="mt-1 text-sm text-foreground">{version.effective_from}</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * VI-F04 S1: the terms in force and the ones that start later. Empty state: no terms yet. The
 * earlier, ended terms are the history of VI-F04-S03.
 */
export function CommercialTermsSummary({ terms }: CommercialTermsSummaryProps) {
  if (!terms.current && terms.upcoming.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-medium text-foreground">No commercial terms yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Revenue cannot be calculated for this partner until terms are saved.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {terms.current && <TermsCard title="Terms in force" version={terms.current} />}
      {terms.upcoming.map((version) => (
        <TermsCard key={version.id} title="Starts later" version={version} />
      ))}
    </div>
  );
}
