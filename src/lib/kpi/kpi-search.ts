import { z } from "zod";

/**
 * The search box of the KPI dashboard (VI-F05-S01, design "Search records…"): it narrows the tiles to the
 * KPIs whose name has the words typed. It only reads what is already on the screen, so it needs no query.
 * The text comes from the address, so it is validated: trimmed, and not longer than a name could need.
 */
export const KPI_SEARCH_MAX_LENGTH = 80;

export const kpiSearchSchema = z.string().trim().max(KPI_SEARCH_MAX_LENGTH);

/** An empty, missing or too long value is no search at all. */
export function parseKpiSearch(value: string | undefined): string {
  const parsed = kpiSearchSchema.safeParse(value ?? "");

  return parsed.success ? parsed.data : "";
}

/** The items whose name has every word of the search, whatever the case; no search keeps them all. */
export function filterBySearch<T extends { label: string }>(items: readonly T[], search: string): T[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);

  return items.filter((item) => words.every((word) => item.label.toLowerCase().includes(word)));
}
