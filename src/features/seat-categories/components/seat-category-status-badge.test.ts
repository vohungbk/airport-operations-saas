import { describe, expect, it } from "vitest";

import { STATUS_VARIANT } from "@/features/seat-categories/components/seat-category-status-badge";

describe("SeatCategoryStatusBadge STATUS_VARIANT", () => {
  it("should map active to the success variant", () => {
    expect(STATUS_VARIANT.active).toBe("success");
  });

  it("should map inactive to a neutral (muted) variant, not destructive", () => {
    expect(STATUS_VARIANT.inactive).toBe("muted");
  });
});
