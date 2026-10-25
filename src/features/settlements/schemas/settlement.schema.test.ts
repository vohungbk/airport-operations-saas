import { describe, expect, it } from "vitest";

import { createGenerateSettlementSchema, currentMonth } from "@/features/settlements/schemas/settlement.schema";

const NOW = new Date("2026-10-25T10:00:00Z");
const PARTNER = "b0000000-0000-0000-0000-000000000001";
const parse = (change: Record<string, unknown> = {}) =>
  createGenerateSettlementSchema(NOW).safeParse({ partner_id: PARTNER, month: "2026-09", ...change });

describe("createGenerateSettlementSchema", () => {
  it("should accept a past month and a seeded partner id (AC04)", () => {
    expect(parse().success).toBe(true);
  });

  it("should accept the current month, which is not in the future", () => {
    expect(parse({ month: "2026-10" }).success).toBe(true);
  });

  it("should refuse a missing month with a clear message", () => {
    const result = parse({ month: undefined });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["month"]);
  });

  it("should refuse an empty month", () => {
    expect(parse({ month: "" }).error?.issues[0].message).toBe("Choose the month.");
  });

  it("should refuse a month in the future", () => {
    expect(parse({ month: "2026-11" }).error?.issues[0].message).toBe("The month cannot be in the future.");
    expect(parse({ month: "2099-01" }).success).toBe(false);
  });

  it.each(["2026-13", "2026-00", "2026-9", "26-09", "2026-09-01", "September"])(
    "should refuse %s, which is not a month",
    (month) => {
      expect(parse({ month }).error?.issues[0].message).toBe("Choose a valid month.");
    },
  );

  it("should refuse a missing or malformed partner", () => {
    expect(parse({ partner_id: undefined }).success).toBe(false);
    expect(parse({ partner_id: "abc" }).error?.issues[0].path).toEqual(["partner_id"]);
  });
});

describe("currentMonth", () => {
  it("should be the month of the clock, in UTC", () => {
    expect(currentMonth(new Date("2026-10-31T23:30:00Z"))).toBe("2026-10");
    expect(currentMonth(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11");
  });
});
