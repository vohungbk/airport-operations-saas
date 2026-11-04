import { describe, expect, it } from "vitest";

import { NETWORK_ERROR, FORBIDDEN_ERROR } from "@/features/bookings/lib/booking-errors";
import { getMoveDialogState } from "@/features/workflow-board/lib/move-dialog-state";

const READY = { ok: true } as const;

describe("getMoveDialogState", () => {
  it("should show no message and allow Move when the seat is ready and nothing failed", () => {
    expect(getMoveDialogState(READY, undefined)).toEqual({
      message: null,
      seatStatus: undefined,
      conflict: false,
      forbidden: false,
      blocked: false,
    });
  });

  it("should show the network error and still allow a retry when saving failed (AC01)", () => {
    const state = getMoveDialogState(READY, NETWORK_ERROR);

    expect(state.message).toBe(NETWORK_ERROR.message);
    expect(state.blocked).toBe(false);
    expect(state.forbidden).toBe(false);
  });

  it("should leave only Cancel when the role may no longer move the booking (AC02)", () => {
    const state = getMoveDialogState(READY, FORBIDDEN_ERROR);

    expect(state.forbidden).toBe(true);
    expect(state.blocked).toBe(true);
    expect(state.message).toBe(FORBIDDEN_ERROR.message);
  });

  it("should offer Refresh, not a blocked Move, when another user moved the booking", () => {
    const state = getMoveDialogState(READY, {
      code: "STEP_CHANGED",
      message: "Another user moved this booking.",
    });

    expect(state.conflict).toBe(true);
    expect(state.blocked).toBe(false);
  });

  it("should block Move and name the seat status when the seat is not ready", () => {
    const state = getMoveDialogState(
      { ok: false, code: "SEAT_NOT_READY", message: "Seat not ready", seat_status: "cleaning" },
      undefined,
    );

    expect(state).toMatchObject({ blocked: true, message: "Seat not ready", seatStatus: "cleaning" });
  });

  it.each(["INVALID_TRANSITION", "NO_SEAT", "NOT_FOUND"] as const)(
    "should block Move after a %s error",
    (code) => {
      expect(getMoveDialogState(READY, { code, message: "x" }).blocked).toBe(true);
    },
  );
});
