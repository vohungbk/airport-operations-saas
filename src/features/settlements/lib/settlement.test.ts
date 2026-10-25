import { describe, expect, it } from "vitest";

import { SETTLEMENT_MOVES, SETTLEMENT_STATUS_LABEL, monthToDate, settlementMonth } from "@/features/settlements/lib/settlement";

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

  it("should offer the forward move from each status, and send back only from pending approval (R8)", () => {
    expect(SETTLEMENT_MOVES.draft.map((m) => m.to)).toEqual(["pending_approval"]);
    expect(SETTLEMENT_MOVES.pending_approval.map((m) => m.to)).toEqual(["approved", "draft"]);
    expect(SETTLEMENT_MOVES.approved.map((m) => m.to)).toEqual(["paid"]);
  });

  it("should offer no move from paid, and none back from approved", () => {
    expect(SETTLEMENT_MOVES.paid).toEqual([]);
    expect(SETTLEMENT_MOVES.approved.map((m) => m.to)).not.toContain("pending_approval");
  });
});
