import { describe, expect, it } from "vitest";

import {
  STEP_DEADLINE_HOURS,
  buildOverdueLabel,
  buildStepDeadlineView,
  getNextStepDeadline,
  getOverdueMinutes,
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

  it.each([
    "pending",
    "preparation",
    "ready",
    "en_route",
    "installed",
    "family_ready",
    "returned",
    "cleaning",
    "inspection",
    "completed",
    "cancelled",
    "no_show",
  ] as const)(
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

  it.each(["preparation", "ready"] as const)(
    "should skip the steps without a deadline and give the deadline of Technician Assigned from %s",
    (status) => {
      const next = getNextStepDeadline(status, PICKUP);

      expect(next?.step).toBe("assigned");
      expect(next?.deadline.toISOString()).toBe("2026-11-10T08:00:00.000Z");
    },
  );

  it.each(["assigned", "en_route", "installed", "family_ready"] as const)(
    "should give the deadline of Active Rental from %s",
    (status) => {
      expect(getNextStepDeadline(status, PICKUP)?.step).toBe("in_progress");
    },
  );

  it.each(["in_progress", "returned", "cleaning", "inspection", "completed", "cancelled", "no_show"] as const)(
    "should give none for %s, with no step with a deadline left",
    (status) => {
      expect(getNextStepDeadline(status, PICKUP)).toBeNull();
    },
  );
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

  it("should mark a booking at Ready overdue once the deadline of Technician Assigned has passed", () => {
    expect(isBookingOverdue("ready", PICKUP, at("2026-11-10T07:59:00Z"))).toBe(false);
    expect(isBookingOverdue("ready", PICKUP, at("2026-11-10T08:01:00Z"))).toBe(true);
  });

  it.each(["cancelled", "no_show"] as const)("should never mark a %s booking overdue", (status) => {
    expect(isBookingOverdue(status, PICKUP, at("2026-11-12T00:00:00Z"))).toBe(false);
  });
});

describe("buildStepDeadlineView", () => {
  it("should give the deadline of the next step in the airport timezone, with the day", () => {
    expect(buildStepDeadlineView("confirmed", PICKUP, "Asia/Dubai", at("2026-11-10T07:00:00Z"))).toEqual({
      dueLabel: "10 Nov 2026 · 12:00 GST",
      overdueLabel: null,
    });
  });

  it("should say how long the booking is overdue after the deadline", () => {
    expect(buildStepDeadlineView("confirmed", PICKUP, "UTC", at("2026-11-10T08:20:00Z"))?.overdueLabel).toBe(
      "Overdue by 20 min",
    );
  });

  it("should give none when the booking has no next deadline", () => {
    expect(buildStepDeadlineView("completed", PICKUP, "UTC", at("2026-11-10T09:00:00Z"))).toBeNull();
  });
});

describe("buildOverdueLabel", () => {
  it("should say how long the next step is overdue", () => {
    expect(buildOverdueLabel("confirmed", PICKUP, at("2026-11-10T08:20:00Z"))).toBe("Overdue by 20 min");
  });

  it("should say hours and minutes for a long delay", () => {
    expect(buildOverdueLabel("confirmed", PICKUP, at("2026-11-10T10:10:00Z"))).toBe("Overdue by 2 h 10 min");
  });

  it("should give none for a booking that is on time", () => {
    expect(buildOverdueLabel("confirmed", PICKUP, at("2026-11-10T07:00:00Z"))).toBeNull();
  });
});

describe("getOverdueMinutes (CO-F08-T01 AC03)", () => {
  it("should give the minutes past the deadline of the next step", () => {
    expect(getOverdueMinutes("confirmed", PICKUP, at("2026-11-10T08:20:00Z"))).toBe(20);
  });

  it("should round up so a booking that is a few seconds late says at least 1 minute", () => {
    expect(getOverdueMinutes("confirmed", PICKUP, at("2026-11-10T08:00:05Z"))).toBe(1);
  });

  it("should give none before or at the deadline", () => {
    expect(getOverdueMinutes("confirmed", PICKUP, at("2026-11-10T08:00:00Z"))).toBeNull();
    expect(getOverdueMinutes("confirmed", PICKUP, at("2026-11-10T07:00:00Z"))).toBeNull();
  });

  it.each(["completed", "cancelled", "no_show"] as const)("should give none for %s", (status) => {
    expect(getOverdueMinutes(status, PICKUP, at("2026-11-12T00:00:00Z"))).toBeNull();
  });
});
