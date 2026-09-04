import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { PartnerStatusBadge } from "@/features/partners/components/partner-status-badge";
import { DeactivatePartnerButton } from "@/features/partners/components/deactivate-partner-button";
import type { Partner } from "@/features/partners/types";

interface PartnerDetailProps {
  partner: Partner;
}

interface PlaceholderCardProps {
  title: string;
  note: string;
}

/**
 * Explicit "not available yet" copy, not a blank or `0` value — Booking
 * Management (F11) and Seat Inventory (F09) don't exist, so there is no
 * real count to show, and a `0` here would look like a real "this
 * partner has zero active bookings" fact instead of "this feature isn't
 * built" (see plan.md's risk note on placeholder data).
 */
function PlaceholderCard({ title, note }: PlaceholderCardProps) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">Not available yet — {note}</p>
    </div>
  );
}

export function PartnerDetail({ partner }: PartnerDetailProps) {
  const isInactive = partner.status === "inactive";

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {partner.name}
          </h1>
          <p className="text-sm text-muted-foreground">Code: {partner.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/partners/${partner.id}/edit`}
            className={buttonVariants({ variant: "outline" })}
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

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Status</dt>
          <dd className="mt-1">
            <PartnerStatusBadge status={partner.status} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Contact email</dt>
          <dd className="mt-1 text-sm text-foreground">{partner.contact_email}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Created</dt>
          <dd className="mt-1 text-sm text-foreground">
            {new Date(partner.created_at).toLocaleDateString()}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PlaceholderCard
          title="Active bookings"
          note="available once Booking Management (F11) ships."
        />
        <PlaceholderCard
          title="Seat / inventory summary"
          note="available once Seat Inventory (F09) ships."
        />
      </div>
    </div>
  );
}
