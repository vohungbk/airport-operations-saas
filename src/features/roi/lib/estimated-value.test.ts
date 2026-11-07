import { describe, expect, it } from "vitest";

import { BREAKDOWN_ROWS, ESTIMATE_LINES, buildEstimateCards } from "@/features/roi/lib/estimated-value";

describe("the estimated business value frame (VI-F05-S04, R10, R13)", () => {
  it("should mark every estimated card as an estimate and show no made-up number", () => {
    const cards = buildEstimateCards("October 2026");

    expect(cards.map((card) => card.label)).toEqual([
      "Estimated avoided costs",
      "Estimated conversion value",
      "Total partner value created",
    ]);
    for (const card of cards) {
      expect(card.value).toBe("Not available");
      expect(card.caption).toMatch(/^Estimate/);
      expect(card.value).not.toMatch(/\d/);
    }
    expect(cards[2].caption).toBe("Estimate · October 2026");
  });

  it("should label every estimated line and cell with Estimate and no number", () => {
    const cells = [
      ...ESTIMATE_LINES.flatMap((line) => [line.label, line.value]),
      ...BREAKDOWN_ROWS.flatMap((row) => [row.baseline, row.scenario, row.estimated]),
    ];

    expect(BREAKDOWN_ROWS.map((row) => row.category)).toEqual(["Staff handling", "Owned inventory", "Customer conversion"]);
    for (const cell of cells) expect(cell).toContain("Estimate");
    for (const line of ESTIMATE_LINES) expect(line.value).not.toMatch(/\d/);
  });
});
