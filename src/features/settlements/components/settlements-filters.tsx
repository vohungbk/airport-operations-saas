"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SETTLEMENT_STATUS_LABEL } from "@/features/settlements/lib/settlement";
import {
  SETTLEMENT_STATUSES,
} from "@/features/settlements/schemas/settlement.schema";
import {
  buildSettlementsHref,
  isSettlementsFiltered,
  type SettlementsQuery,
} from "@/features/settlements/schemas/settlements-query.schema";

interface SettlementsFiltersProps {
  query: SettlementsQuery;
  /** The partners an operations user may filter by; empty for a partner user, who has no such filter. */
  partners: ReadonlyArray<{ value: string; label: string }>;
}

const ALL_VALUE = "all";

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
      {children}
    </label>
  );
}

/**
 * The filters of the Settlements list as the design lays them out, in one card: Partner (not for a
 * partner user), Period (a month), Status and Clear filters. A change goes to the address and back to
 * page 1; the query was cleaned on the server, so only serializable data crosses the boundary.
 */
export function SettlementsFilters({ query, partners }: SettlementsFiltersProps) {
  const router = useRouter();
  const isFiltered = isSettlementsFiltered(query);

  function go(change: Partial<SettlementsQuery>) {
    router.push(buildSettlementsHref(query, { ...change, page: 1 }));
  }

  const partnerItems = [{ value: ALL_VALUE, label: "All partners" }, ...partners];
  const statusItems = [
    { value: ALL_VALUE, label: "All statuses" },
    ...SETTLEMENT_STATUSES.map((value) => ({ value, label: SETTLEMENT_STATUS_LABEL[value] })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-card p-5">
      {partners.length > 0 && (
        <div className="flex w-full flex-col gap-2 sm:w-64">
          <FieldLabel htmlFor="settlement-partner">Partner</FieldLabel>
          <Select
            value={query.partner_id ?? ALL_VALUE}
            items={partnerItems}
            onValueChange={(value) => go({ partner_id: !value || value === ALL_VALUE ? undefined : value })}
          >
            <SelectTrigger id="settlement-partner" aria-label="Filter by partner" className="h-11 w-full data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {partnerItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex w-full flex-col gap-2 sm:w-56">
        <FieldLabel htmlFor="settlement-period">Period</FieldLabel>
        <Input
          id="settlement-period"
          type="month"
          aria-label="Filter by period"
          value={query.month ?? ""}
          onChange={(event) => go({ month: event.target.value || undefined })}
          className="h-11"
        />
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-56">
        <FieldLabel htmlFor="settlement-status">Status</FieldLabel>
        <Select
          value={query.status ?? ALL_VALUE}
          items={statusItems}
          onValueChange={(value) =>
            go({ status: !value || value === ALL_VALUE ? undefined : (value as SettlementsQuery["status"]) })
          }
        >
          <SelectTrigger id="settlement-status" aria-label="Filter by status" className="h-11 w-full data-[size=default]:h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Link
        href="/settlements"
        aria-disabled={!isFiltered}
        className={buttonVariants({
          variant: "outline",
          className: cn("min-h-11 min-w-32 px-4", !isFiltered && "pointer-events-none opacity-50"),
        })}
      >
        Clear filters
      </Link>
    </div>
  );
}
