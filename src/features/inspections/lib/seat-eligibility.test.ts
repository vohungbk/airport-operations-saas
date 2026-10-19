import { describe, expect, it } from "vitest";

import { SEAT_STATUSES } from "@/features/seats/lib/seat-status";
import { canInspectSeat } from "@/features/inspections/lib/seat-eligibility";

describe("canInspectSeat", () => {
  it.each(
    SEAT_STATUSES.filter((status) => status !== "retired").map((s) => [s]),
  )("should allow a seat that is %s", (status) => {
    expect(canInspectSeat(status)).toBe(true);
  });

  it("should reject a retired seat, which is terminal", () => {
    expect(canInspectSeat("retired")).toBe(false);
  });
});
