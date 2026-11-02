import { describe, expect, it } from "vitest";

import {
  NO_SEAT_MESSAGE,
  SEAT_FOLLOWS,
  STEP_MOVER_ROLES,
  checkMoveReadiness,
  getNextStep,
  mayRoleMoveTo,
  seatNotReadyMessage,
} from "@/features/bookings/lib/booking-move";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

describe("getNextStep", () => {
  it.each([
    ["pending", "confirmed"],
    ["confirmed", "assigned"],
    ["assigned", "in_progress"],
    ["in_progress", "completed"],
  ] as const)("should give %s the next step %s", (status, next) => {
    expect(getNextStep(status)).toBe(next);
  });

  it("should give no next step at the last step", () => {
    expect(getNextStep("completed")).toBeNull();
  });

  it.each(["cancelled", "no_show"] as const)("should give no next step off the path: %s", (status) => {
    expect(getNextStep(status)).toBeNull();
  });
});

describe("mayRoleMoveTo (AC02)", () => {
  it("should name the roles for every step after the first", () => {
    for (const step of BOOKING_BOARD_STEPS.slice(1)) {
      expect(STEP_MOVER_ROLES[step], step).toBeDefined();
    }
  });

  it.each(["confirmed", "assigned", "in_progress", "completed"] as const)(
    "should let admin and operations manager move to %s",
    (step) => {
      expect(mayRoleMoveTo("admin", step)).toBe(true);
      expect(mayRoleMoveTo("operations_manager", step)).toBe(true);
    },
  );

  it("should let a technician move to the field steps only", () => {
    expect(mayRoleMoveTo("technician", "in_progress")).toBe(true);
    expect(mayRoleMoveTo("technician", "completed")).toBe(true);
    expect(mayRoleMoveTo("technician", "confirmed")).toBe(false);
    expect(mayRoleMoveTo("technician", "assigned")).toBe(false);
  });

  it("should let a partner user move to no step", () => {
    for (const step of BOOKING_BOARD_STEPS) {
      expect(mayRoleMoveTo("partner_user", step), step).toBe(false);
    }
  });

  it("should not let anyone move to the first step, which is where a booking starts", () => {
    expect(mayRoleMoveTo("admin", "pending")).toBe(false);
  });
});

describe("checkMoveReadiness (AC01)", () => {
  it("should need no seat to confirm", () => {
    expect(checkMoveReadiness("confirmed", null)).toEqual({ ok: true });
  });

  it.each([
    ["assigned", "available"],
    ["in_progress", "reserved"],
    ["completed", "in_use"],
  ] as const)("should be ready to move to %s when the seat is %s", (step, seat) => {
    expect(checkMoveReadiness(step, { status: seat })).toEqual({ ok: true });
  });

  it("should ask for a seat when the booking has none", () => {
    expect(checkMoveReadiness("assigned", null)).toEqual({ ok: false, code: "NO_SEAT", message: NO_SEAT_MESSAGE });
  });

  it("should say what the seat must be, and what it is, when the seat is not ready", () => {
    expect(checkMoveReadiness("assigned", { status: "cleaning" })).toEqual({
      ok: false,
      code: "SEAT_NOT_READY",
      message: "The seat must be Available before Assigned",
      seat_status: "cleaning",
    });
    expect(seatNotReadyMessage("in_progress")).toBe("The seat must be Reserved before In progress");
  });

  it("should hand the seat from one step to the next without a gap (CO-F08-S04 AC01)", () => {
    const withRule = BOOKING_BOARD_STEPS.filter((step) => SEAT_FOLLOWS[step]);

    expect(withRule).toEqual(["assigned", "in_progress", "completed"]);
    for (let i = 1; i < withRule.length; i += 1) {
      expect(SEAT_FOLLOWS[withRule[i]!]?.from).toBe(SEAT_FOLLOWS[withRule[i - 1]!]?.to);
    }
  });

  it("should name the seat status that blocks the move (CO-F08-S04 AC02)", () => {
    expect(checkMoveReadiness("completed", { status: "quarantine" })).toEqual({
      ok: false,
      code: "SEAT_NOT_READY",
      message: "The seat must be In use before Completed",
      seat_status: "quarantine",
    });
  });

  it("should make the seat follow along its own path: reserved, in use, then available again", () => {
    expect(SEAT_FOLLOWS.assigned).toEqual({ from: "available", to: "reserved" });
    expect(SEAT_FOLLOWS.in_progress).toEqual({ from: "reserved", to: "in_use" });
    expect(SEAT_FOLLOWS.completed).toEqual({ from: "in_use", to: "available" });
  });
});
