import { describe, expect, it } from "vitest";

import { checkStatusTransition } from "@/features/bookings/lib/booking-step-order";
import { BOOKING_STATUSES } from "@/features/bookings/lib/booking-status";
import { BOOKING_BOARD_STEPS, stepOf } from "@/lib/workflow/board";

describe("checkStatusTransition", () => {
  it("should allow the manual change to the next step: pending to confirmed", () => {
    expect(checkStatusTransition("pending", "confirmed")).toEqual({ ok: true });
  });

  it.each([
    ["pending", "cancelled"],
    ["confirmed", "cancelled"],
    ["assigned", "cancelled"],
    ["in_progress", "cancelled"],
    ["confirmed", "no_show"],
  ] as const)("should allow leaving the path by hand: %s to %s", (from, to) => {
    expect(checkStatusTransition(from, to)).toEqual({ ok: true });
  });

  it("should reject a skipped step and name the steps that come first", () => {
    expect(checkStatusTransition("pending", "completed")).toEqual({
      ok: false,
      message: "Cannot move a booking from Pending to Completed. Confirmed, Assigned and In progress come first.",
    });
  });

  it("should say 'comes' when one step is skipped", () => {
    expect(checkStatusTransition("pending", "assigned")).toEqual({
      ok: false,
      message: "Cannot move a booking from Pending to Assigned. Confirmed comes first.",
    });
  });

  it("should not set a step of the operations workflow by hand, even the next one", () => {
    expect(checkStatusTransition("confirmed", "assigned")).toEqual({
      ok: false,
      message: "Assigned is set by the operations workflow, not by hand.",
    });
  });

  it("should reject a step back", () => {
    expect(checkStatusTransition("in_progress", "pending")).toEqual({
      ok: false,
      message: "A booking cannot move back from In progress to Pending.",
    });
  });

  it("should reject a change to the status the booking already has", () => {
    expect(checkStatusTransition("confirmed", "confirmed")).toEqual({
      ok: false,
      message: "The booking is already Confirmed.",
    });
  });

  it.each(["cancelled", "no_show", "completed"] as const)(
    "should reject any change out of %s, which the booking cannot leave",
    (from) => {
      for (const to of BOOKING_STATUSES.filter((status) => status !== from)) {
        expect(checkStatusTransition(from, to).ok, `${from} to ${to}`).toBe(false);
      }
    },
  );

  it.each(["assigned", "in_progress"] as const)(
    "should reject marking a booking that is %s as a no-show",
    (from) => {
      expect(checkStatusTransition(from, "no_show").ok).toBe(false);
    },
  );

  it("should only ever allow, by hand, a change that is the next step or leaves the path", () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        if (!checkStatusTransition(from, to).ok) continue;

        const path: readonly string[] = BOOKING_BOARD_STEPS;
        const next = path.indexOf(to) === path.indexOf(from) + 1;
        const leaves = to === "cancelled" || to === "no_show";
        expect(next || leaves, `${from} to ${to}`).toBe(true);
      }
    }
  });
});

describe("the step of a booking created before the step order (AC04)", () => {
  it.each([
    ["pending", 1],
    ["confirmed", 2],
    ["assigned", 3],
    ["in_progress", 4],
    ["completed", 5],
  ] as const)("should map %s to step %i of the path by its current status", (status, number) => {
    expect(stepOf(status)?.number).toBe(number);
  });

  it.each(["cancelled", "no_show"] as const)("should leave %s off the path, with no step", (status) => {
    expect(stepOf(status)).toBeNull();
  });
});
