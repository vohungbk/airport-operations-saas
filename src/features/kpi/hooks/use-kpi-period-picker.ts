"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { resolveKpiPeriod } from "@/lib/kpi/kpi-period";

/**
 * The choice of a period, of the comparison and of the search (VI-F05-S01, F1, V1). The period is checked here before the
 * address changes, with the same function the page runs on the server, so a month in the future shows the
 * message at once and never reaches the page from the picker.
 */
export function useKpiPeriodPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }

    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function choose(param: string) {
    const result = resolveKpiPeriod(param, new Date());

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    go({ period: result.period.param });
  }

  /** `off` turns the comparison off; anything else turns it on. */
  function chooseCompare(value: string) {
    go({ compare: value === "off" ? "off" : null });
  }

  /** An empty search takes the search out of the address. */
  function search(text: string) {
    go({ q: text.trim() === "" ? null : text.trim() });
  }

  function clear() {
    setError(null);
    go({ period: null, compare: null, q: null });
  }

  return { error, choose, chooseCompare, search, clear };
}
