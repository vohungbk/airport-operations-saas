import { describe, expect, it } from "vitest";

import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";
import { getDashboardState } from "@/features/dashboard/lib/dashboard-state";

const results = (...values: (number | null)[]) =>
  values.map((value, i) => ({ metric: DASHBOARD_METRICS[i], value }));

describe("getDashboardState", () => {
  it("should be ready when a figure is above zero", () => {
    expect(getDashboardState(results(0, 4))).toBe("ready");
  });

  it("should be empty only when every figure was read and is zero", () => {
    expect(getDashboardState(results(0, 0, 0))).toBe("empty");
  });

  it("should be partial when some figures could not be read, even if the rest are zero", () => {
    expect(getDashboardState(results(0, null))).toBe("partial");
    expect(getDashboardState(results(5, null))).toBe("partial");
  });

  it("should be unavailable when no figure could be read", () => {
    expect(getDashboardState(results(null, null))).toBe("unavailable");
  });

  it("should never call an unreadable figure zero", () => {
    expect(getDashboardState(results(null))).not.toBe("empty");
  });
});
