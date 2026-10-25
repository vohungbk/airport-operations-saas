import { describe, expect, it } from "vitest";

import { SETTLEMENT_STATUS_LABEL, monthToDate, settlementMonth } from "@/features/settlements/lib/settlement";

describe("settlement helpers", () => {
  it("should turn a month into its first day", () => {
    expect(monthToDate("2026-09")).toBe("2026-09-01");
  });

  it("should read the month of a settlement from its period start", () => {
    expect(settlementMonth("2026-09-01")).toBe("2026-09");
  });

  it("should label every status of the enum", () => {
    expect(Object.keys(SETTLEMENT_STATUS_LABEL).sort()).toEqual(["approved", "draft", "paid", "pending_approval"]);
  });
});
