import { describe, expect, it } from "vitest";

import { toStockRows } from "@/features/dashboard/lib/stock-rows";

describe("toStockRows percent", () => {
  it.each([
    [10, 100, 10],
    [16, 80, 20],
    [0, 5, 0],
    [3, 0, 0],
    [9, 4, 100],
  ])("should give %i available of %i seats as %i percent", (available, total, expected) => {
    expect(toStockRows([{ label: "Booster", available, total }])[0].percent).toBe(expected);
  });
});

describe("toStockRows", () => {
  it("should give each category its symbol, color and count in the order given", () => {
    const rows = toStockRows([
      { label: "Infant Carrier", available: 10, total: 100 },
      { label: "Convertible", available: 16, total: 80 },
    ]);

    expect(rows.map((row) => [row.label, row.symbol, row.color, row.count, row.percent])).toEqual([
      ["Infant Carrier", "●", "var(--chart-1)", 10, 10],
      ["Convertible", "◆", "var(--chart-2)", 16, 20],
    ]);
  });

  it("should give no row when there is no category", () => {
    expect(toStockRows([])).toEqual([]);
  });
});
