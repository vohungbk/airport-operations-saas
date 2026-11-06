import { describe, expect, it } from "vitest";

import { kpiPeriodSchema } from "@/lib/kpi/kpi-period.schema";

describe("kpiPeriodSchema", () => {
  it("should accept a period whose end is after its start", () => {
    const result = kpiPeriodSchema.safeParse({ from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" });

    expect(result.success).toBe(true);
  });

  it("should reject a period whose end is not after its start", () => {
    const same = kpiPeriodSchema.safeParse({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" });
    const reversed = kpiPeriodSchema.safeParse({ from: "2026-11-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" });

    expect(same.success).toBe(false);
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0]?.path).toEqual(["to"]);
  });

  it("should reject a value that is not a date and time, and a missing value", () => {
    expect(kpiPeriodSchema.safeParse({ from: "yesterday", to: "2026-11-01T00:00:00.000Z" }).success).toBe(false);
    expect(kpiPeriodSchema.safeParse({ from: "2026-10-01T00:00:00.000Z" }).success).toBe(false);
  });
});
