import { describe, expect, it } from "vitest";

import { FLIGHT_SOURCE_LABELS, formatLastSync } from "./provider-status-labels";

describe("formatLastSync", () => {
  it("should show the time in UTC", () => {
    expect(formatLastSync("2026-12-01T10:05:30Z")).toBe("2026-12-01 10:05 UTC");
  });

  it("should say never synced when there is no sync", () => {
    expect(formatLastSync(null)).toBe("Never synced");
  });

  it("should say never synced when the value is not a date", () => {
    expect(formatLastSync("garbage")).toBe("Never synced");
  });
});

describe("FLIGHT_SOURCE_LABELS", () => {
  it("should have a label for each of the three sources", () => {
    expect(Object.keys(FLIGHT_SOURCE_LABELS).sort()).toEqual(["provider", "sandbox", "simulator"]);
  });
});
