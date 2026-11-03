import { describe, expect, it } from "vitest";

import {
  STEP_DEADLINE_HOURS,
  buildStepDeadlineView,
  getNextStepDeadline,
  getStepDeadline,
  isBookingOverdue,
} from "@/features/bookings/lib/booking-deadlines";

const PICKUP = "2026-11-10T12:00:00Z";
const at = (iso: string) => new Date(iso);

describe("getStepDeadline (CO-F08-S07 AC01)", () => {
  it.each([
    ["confirmed", "2026-11-09T12:00:00.000Z"],
    ["assigned", "2026-11-10T08:00:00.000Z"],
    ["in_progress", "2026-11-10T11:00:00.000Z"],
  ] as const)("should count the deadline of %s back from the pickup time", (step, expected) => {
    expect(getStepDeadline(step, PICKUP)?.toISOString()).toBe(expected);
  });

  it.each(["pending", "completed", "cancelled", "no_show"] as const)(
    "should give no deadline to %s",
    (step) => {
      expect(getStepDeadline(step, PICKUP)).toBeNull();
    },
  );

  it("should keep the deadlines in step order, the first step earliest", () => {
    expect(STEP_DEADLINE_HOURS.confirmed).toBeGreaterThan(STEP_DEADLINE_HOURS.assigned ?? 0);
    expect(STEP_DEADLINE_HOURS.assigned).toBeGreaterThan(STEP_DEADLINE_HOURS.in_progress ?? 0);
  });
});

describe("getNextStepDeadline", () => {
  it("should give the deadline of the step after the current one", () => {
    const next = getNextStepDeadline("confirmed", PICKUP);

    expect(next?.step).toBe("assigned");
    expect(next?.deadline.toISOString()).toBe("2026-11-10T08:00:00.000Z");
  });

  it.each(["completed", "cancelled", "no_show"] as const)("should give none for %s", (status) => {
    expect(getNextStepDeadline(status, PICKUP)).toBeNull();
  });
});

describe("isBookingOverdue (CO-F08-S07 AC01)", () => {
  it("should not mark a booking overdue before the deadline of its next step", () => {
    expect(isBookingOverdue("confirmed", PICKUP, at("2026-11-10T07:59:00Z"))).toBe(false);
  });

  it("should mark a booking overdue once the deadline of its next step has passed", () => {
    expect(isBookingOverdue("confirmed", PICKUP, at("2026-11-10T08:01:00Z"))).toBe(true);
  });

  it("should not mark a booking overdue exactly at the deadline", () => {
    expect(isBookingOverdue("confirmed", PICKUP, at("2026-11-10T08:00:00Z"))).toBe(false);
  });

  it("should mark a new booking overdue when it is not confirmed in time", () => {
    expect(isBookingOverdue("pending", PICKUP, at("2026-11-09T12:01:00Z"))).toBe(true);
  });

  it("should not mark a booking overdue after it reached the step, even past the pickup time", () => {
    expect(isBookingOverdue("completed", PICKUP, at("2026-11-12T00:00:00Z"))).toBe(false);
  });

  it.each(["cancelled", "no_show"] as const)("should never mark a %s booking overdue", (status) => {
    expect(isBookingOverdue(status, PICKUP, at("2026-11-12T00:00:00Z"))).toBe(false);
  });
});

describe("buildStepDeadlineView", () => {
  it("should name the next step and give its deadline in the airport timezone", () => {
    expect(buildStepDeadlineView("confirmed", PICKUP, "Asia/Dubai", at("2026-11-10T07:00:00Z"))).toEqual({
      stepLabel: "Assigned",
      dueLabel: "10 Nov 2026, 12:00",
      overdue: false,
    });
  });

  it("should flag the view overdue after the deadline", () => {
    expect(buildStepDeadlineView("confirmed", PICKUP, "UTC", at("2026-11-10T09:00:00Z"))?.overdue).toBe(true);
  });

  it("should give none when the booking has no next deadline", () => {
    expect(buildStepDeadlineView("completed", PICKUP, "UTC", at("2026-11-10T09:00:00Z"))).toBeNull();
  });
});
