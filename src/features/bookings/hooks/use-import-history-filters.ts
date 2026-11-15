"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  buildImportHistoryHref,
  type ImportHistoryFilters,
} from "@/features/bookings/lib/booking-import-history";

export const ALL_FILTER_VALUE = "all";

/** The value of a filter that means "no filter" is `all`; the address carries nothing for it. */
function toFilterValue(value: string | null): string | undefined {
  return !value || value === ALL_FILTER_VALUE ? undefined : value;
}

/** CO-F07-S07: changing a filter opens the history again at page 1 with the new filters. */
export function useImportHistoryFilters(filters: ImportHistoryFilters) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(change: Partial<Pick<ImportHistoryFilters, "partner_id" | "actor_id" | "period">>) {
    startTransition(() => {
      router.push(buildImportHistoryHref(filters, { ...change, page: 1 }));
    });
  }

  return {
    isPending,
    setPartner: (value: string | null) => change({ partner_id: toFilterValue(value) }),
    setActor: (value: string | null) => change({ actor_id: toFilterValue(value) }),
    setPeriod: (value: string | null) => {
      if (value) change({ period: value as ImportHistoryFilters["period"] });
    },
  };
}
