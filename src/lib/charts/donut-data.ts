import { abbreviateNumber, formatFullNumber, type ChartSeries, type ChartTable } from "@/lib/charts/chart-data";

/**
 * Pure logic for the donut chart (UI-F05-S03, spec R2, E1, E3). The chart only draws what it is
 * given; this works out the shares, and words the same numbers as text and as a table.
 */

export interface DonutItem {
  label: string;
  /** `null`, a negative number or one that is not a number is a gap: a share of nothing cannot be drawn. */
  value: number | null;
}

export interface DonutSlice {
  label: string;
  value: number;
  /** A whole percent. The shares of all slices add up to 100. */
  share: number;
}

export interface DonutData {
  slices: DonutSlice[];
  total: number;
}

const isShare = (value: number | null): value is number => value !== null && Number.isFinite(value) && value >= 0;

/**
 * Whole percents that add up to 100 (the largest remainder method), so the legend never reads 99 or
 * 101. With a total of 0 every share is 0.
 */
export function wholeShares(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((value) => (value / total) * 100);
  const shares = exact.map(Math.floor);
  const missing = 100 - shares.reduce((sum, share) => sum + share, 0);
  const byRemainder = exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let i = 0; i < missing; i += 1) shares[byRemainder[i].index] += 1;
  return shares;
}

/** The slices that can be drawn, in the order given, with the total. A slice of 0 is kept, with a share of 0. */
export function toSlices(items: readonly DonutItem[]): DonutData {
  const valid = items.filter((item): item is DonutItem & { value: number } => isShare(item.value));
  const shares = wholeShares(valid.map((item) => item.value));
  return {
    slices: valid.map((item, index) => ({ label: item.label, value: item.value, share: shares[index] })),
    total: valid.reduce((sum, item) => sum + item.value, 0),
  };
}

/** The items as a series for the frame, with a gap in place of a value that cannot be a share. */
export const toDonutSeries = (items: readonly DonutItem[], name: string): ChartSeries[] => [
  { name, points: items.map((item) => ({ label: item.label, value: isShare(item.value) ? item.value : null })) },
];

/** "Available 120 (62%)": one slice for the legend. */
export const sliceDetail = (slice: DonutSlice) => `${formatFullNumber(slice.value)} · ${slice.share}%`;

/** Every slice by name, value and share, and the total, for the label of the chart. */
export function describeSlices(title: string, { slices, total }: DonutData): string {
  const parts = slices.map((slice) => `${slice.label} ${formatFullNumber(slice.value)} (${slice.share}%)`);
  return `${title}: ${parts.join(", ")}; total ${formatFullNumber(total)}`;
}

/** The total as the chart shows it in the middle: shortened, with the full number in the table. */
export const centerTotal = (total: number) => abbreviateNumber(total);

/** The same numbers as the chart: name, full count and share, and a row for the total. A gap shows a dash. */
export function donutTable(items: readonly DonutItem[], seriesName: string, labelHeading = "Name"): ChartTable {
  const { slices, total } = toSlices(items);
  const rows = items.map((item) => {
    const slice = isShare(item.value) ? slices.find((s) => s.label === item.label) : undefined;
    return [item.label, formatFullNumber(slice?.value ?? null), slice ? `${slice.share}%` : "-"];
  });
  if (slices.length > 0) rows.push(["Total", formatFullNumber(total), "100%"]);
  return { columns: [labelHeading, seriesName, "Share"], rows };
}
