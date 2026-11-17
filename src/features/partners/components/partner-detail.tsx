import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { PartnerDetailBackLink } from "@/features/partners/components/partner-detail-back-link";
import { PartnerStatusBadge, STATUS_LABEL } from "@/features/partners/components/partner-status-badge";
import { DeactivatePartnerButton } from "@/features/partners/components/deactivate-partner-button";
import { formatRecordDate } from "@/features/partners/lib/format-record-date";
import type { Partner } from "@/features/partners/types";
import { cn } from "@/lib/utils";

interface PartnerDetailProps {
  partner: Partner;
}

interface DetailFieldProps {
  label: string;
  value: string | null;
  className?: string;
}

/** A label over its value. An empty value is a plain dash. */
function DetailField({ label, value, className }: DetailFieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm break-words whitespace-pre-line text-foreground">
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}

interface DetailCardProps {
  title: string;
  children: React.ReactNode;
  /** Two columns from 640 px up (partner information) or always one (record info). */
  twoColumns?: boolean;
}

function DetailCard({ title, children, twoColumns = false }: DetailCardProps) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <dl
        className={cn(
          "mt-5 grid grid-cols-1 gap-x-6 gap-y-5",
          twoColumns && "sm:grid-cols-2",
        )}
      >
        {children}
      </dl>
    </section>
  );
}

/** Server Component. The detail of a partner, as in the design: header, partner information, record info. */
export function PartnerDetail({ partner }: PartnerDetailProps) {
  const isInactive = partner.status === "inactive";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-8">
      <PartnerDetailBackLink />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight break-words text-foreground">
            {partner.name}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{partner.code}</span>
            <PartnerStatusBadge status={partner.status} showDot />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/partners/${partner.id}/terms`}
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 bg-surface px-4 dark:bg-surface",
            })}
          >
            Commercial terms
          </Link>
          <Link
            href={`/partners/${partner.id}/edit`}
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 bg-surface px-4 dark:bg-surface",
            })}
          >
            Edit
          </Link>
          {!isInactive && (
            <DeactivatePartnerButton
              partnerId={partner.id}
              partnerName={partner.name}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <DetailCard title="Partner information" twoColumns>
          <DetailField label="Partner code" value={partner.code} />
          <DetailField label="Partner name" value={partner.name} />
          <DetailField label="Status" value={STATUS_LABEL[partner.status]} />
          <DetailField label="Contact name" value={partner.contact_name} />
          <DetailField label="Contact email" value={partner.contact_email} />
          <DetailField label="Contact phone" value={partner.contact_phone} />
          <DetailField label="Notes" value={partner.notes} className="sm:col-span-2" />
        </DetailCard>

        <DetailCard title="Record info">
          <DetailField label="Created at" value={formatRecordDate(partner.created_at)} />
          <DetailField label="Updated at" value={formatRecordDate(partner.updated_at)} />
        </DetailCard>
      </div>
    </div>
  );
}
