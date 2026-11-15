import { describe, expect, it } from "vitest";

import {
  buildImportHistoryHref,
  getImportHistoryPeriodStart,
  getImportResult,
} from "@/features/bookings/lib/booking-import-history";

const NOW = new Date("2026-11-15T10:00:00Z");

describe("import history rules (CO-F07-S07)", () => {
  it.each([
    [128, 0, "completed"],
    [94, 6, "completed_with_rejects"],
    [0, 40, "failed"],
  ])("should read %i created and %i rejected rows as %s", (created, rejected, expected) => {
    expect(getImportResult(created, rejected)).toBe(expected);
  });

  it.each([
    ["7d", "2026-11-08T10:00:00.000Z"],
    ["30d", "2026-10-16T10:00:00.000Z"],
    ["90d", "2026-08-17T10:00:00.000Z"],
    ["all", null],
  ] as const)("should start the period %s at %s", (period, expected) => {
    expect(getImportHistoryPeriodStart(period, NOW)).toBe(expected);
  });

  it("should keep the filters in the address and leave out the defaults", () => {
    expect(buildImportHistoryHref({ period: "30d", page: 1 })).toBe("/bookings/import/history");
    expect(
      buildImportHistoryHref({ partner_id: "p-1", actor_id: "u-1", period: "7d", page: 3 }),
    ).toBe("/bookings/import/history?partner_id=p-1&actor_id=u-1&period=7d&page=3");
  });

  it("should go back to page 1 when asked to override the page", () => {
    expect(buildImportHistoryHref({ partner_id: "p-1", period: "30d", page: 4 }, { page: 1 })).toBe(
      "/bookings/import/history?partner_id=p-1",
    );
  });
});
