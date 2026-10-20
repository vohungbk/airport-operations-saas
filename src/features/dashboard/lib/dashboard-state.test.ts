import { describe, expect, it } from "vitest";

import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";
import {
  getDashboardState,
  hasUnreleasedMetrics,
} from "@/features/dashboard/lib/dashboard-state";

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

const notReleased = (index: number) => ({
  metric: DASHBOARD_METRICS[index],
  value: null,
  reason: "not_released" as const,
});

describe("getDashboardState with modules that are not released", () => {
  it("should not count a figure that is not available yet as zero when the others are read", () => {
    // Zero, zero and one not available yet: empty because everything read is
    // zero, not because the unreleased figure was counted as zero.
    expect(
      getDashboardState([...results(0, 0), notReleased(2)]),
    ).toBe("empty");
    expect(
      getDashboardState([...results(0, 3), notReleased(2)]),
    ).toBe("ready");
  });

  it("should not take a figure that is not available yet for a failed read", () => {
    expect(getDashboardState([...results(2), notReleased(1)])).toBe("ready");
  });

  it("should still report a real failed read next to a figure that is not available yet", () => {
    expect(getDashboardState([...results(null, 2), notReleased(2)])).toBe(
      "partial",
    );
    expect(getDashboardState([...results(null), notReleased(1)])).toBe(
      "unavailable",
    );
  });

  it("should be ready, not empty, when every figure is not available yet", () => {
    expect(getDashboardState([notReleased(0), notReleased(1)])).toBe("ready");
  });
});

describe("hasUnreleasedMetrics", () => {
  it("should say whether some figure is not available yet", () => {
    expect(hasUnreleasedMetrics(results(1, 2))).toBe(false);
    expect(hasUnreleasedMetrics([...results(1), notReleased(1)])).toBe(true);
  });
});
