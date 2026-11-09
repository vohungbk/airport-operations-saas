import { describe, expect, it } from "vitest";

import { isNothingToAttend } from "@/features/dashboard/lib/command-centre-state";

const base = { arrivalsToday: 0, installationsDue: 0, overdueTasks: 0, flightAlertCount: 0 };

describe("isNothingToAttend", () => {
  it("should be true when every figure is zero and no flight alert is shown", () => {
    expect(isNothingToAttend(base)).toBe(true);
  });

  it.each([
    ["arrivals today", { arrivalsToday: 1 }],
    ["installations due", { installationsDue: 2 }],
    ["overdue tasks", { overdueTasks: 3 }],
    ["a flight alert", { flightAlertCount: 1 }],
  ])("should be false when there is %s", (_name, change) => {
    expect(isNothingToAttend({ ...base, ...change })).toBe(false);
  });

  it.each([
    ["arrivals today", { arrivalsToday: null }],
    ["installations due", { installationsDue: null }],
    ["overdue tasks", { overdueTasks: null }],
  ])("should be false when %s could not be read", (_name, change) => {
    expect(isNothingToAttend({ ...base, ...change })).toBe(false);
  });
});
