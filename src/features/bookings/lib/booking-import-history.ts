/**
 * CO-F07-S07: the rules of the Import history screen that need no database: the periods of the filter,
 * the result of an import, and the address of a page.
 */

export const IMPORT_HISTORY_PAGE_SIZE = 10;

export const IMPORT_HISTORY_PERIODS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "all", label: "All time", days: null },
] as const;

export type ImportHistoryPeriod = (typeof IMPORT_HISTORY_PERIODS)[number]["value"];

export const IMPORT_HISTORY_PERIOD_VALUES = IMPORT_HISTORY_PERIODS.map((period) => period.value) as [
  ImportHistoryPeriod,
  ...ImportHistoryPeriod[],
];

export const IMPORT_HISTORY_DEFAULT_PERIOD: ImportHistoryPeriod = "30d";

/** The start of a period as an ISO time, or `null` for "All time". */
export function getImportHistoryPeriodStart(period: ImportHistoryPeriod, now: Date): string | null {
  const days = IMPORT_HISTORY_PERIODS.find((item) => item.value === period)?.days ?? null;

  return days === null ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type ImportResult = "completed" | "completed_with_rejects" | "failed";

export const IMPORT_RESULT_LABEL: Record<ImportResult, string> = {
  completed: "Completed",
  completed_with_rejects: "Completed with rejects",
  failed: "Failed",
};

/** An import that created no booking failed; one that left rows out completed with rejects. */
export function getImportResult(createdRows: number, rejectedRows: number): ImportResult {
  if (createdRows === 0) return "failed";

  return rejectedRows > 0 ? "completed_with_rejects" : "completed";
}

export interface ImportHistoryFilters {
  partner_id?: string;
  actor_id?: string;
  period: ImportHistoryPeriod;
  page: number;
}

/** The address of the history with the filters kept; the page is left out for page 1. */
export function buildImportHistoryHref(filters: ImportHistoryFilters, override: Partial<ImportHistoryFilters> = {}): string {
  const next = { ...filters, ...override };
  const params = new URLSearchParams();

  if (next.partner_id) params.set("partner_id", next.partner_id);
  if (next.actor_id) params.set("actor_id", next.actor_id);
  if (next.period !== IMPORT_HISTORY_DEFAULT_PERIOD) params.set("period", next.period);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();

  return query ? `/bookings/import/history?${query}` : "/bookings/import/history";
}
