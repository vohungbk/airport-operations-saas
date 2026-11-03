import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { mapMoveError } from "@/features/bookings/lib/move-booking-errors";

const error = (code: string, details: string | null = null): PostgrestError =>
  ({ code, message: "raw database text: relation bookings", details, hint: null, name: "PostgrestError" }) as unknown as PostgrestError;

describe("mapMoveError", () => {
  it("should say who moved the booking first and show the step it is at now (AC03)", () => {
    expect(mapMoveError(error("BK007", "assigned"), "assigned")).toEqual({
      code: "STEP_CHANGED",
      message: "Another user moved this booking. It is now in Technician Assigned.",
      current_step: "assigned",
    });
  });

  it("should still say that the booking was moved when the current step is not a known value", () => {
    const result = mapMoveError(error("BK007", "garbage"), "assigned");

    expect(result.code).toBe("STEP_CHANGED");
    expect(result.message).toBe("Another user moved this booking.");
    expect(result.current_step).toBeUndefined();
  });

  it("should say what the seat must be and give the seat status it has", () => {
    expect(mapMoveError(error("BK009", "cleaning"), "assigned")).toEqual({
      code: "SEAT_NOT_READY",
      message: "The seat must be Available before Technician Assigned",
      seat_status: "cleaning",
    });
  });

  it("should ask for a seat when there is none", () => {
    expect(mapMoveError(error("BK008"), "assigned")).toEqual({
      code: "NO_SEAT",
      message: "Assign a seat to this booking first.",
    });
  });

  it("should name the step in the message of a role that is not allowed (AC02)", () => {
    expect(mapMoveError(error("42501"), "assigned")).toEqual({
      code: "FORBIDDEN",
      message: "Your role is not allowed to move this booking to Technician Assigned.",
    });
  });

  it("should say that a step cannot be skipped", () => {
    expect(mapMoveError(error("55000"), "completed")).toEqual({
      code: "INVALID_TRANSITION",
      message: "This step cannot be skipped",
    });
  });

  it("should return not found for a booking that is not there", () => {
    expect(mapMoveError(error("P0002"), "confirmed").code).toBe("NOT_FOUND");
  });

  it("should never pass the raw database text to the client", () => {
    for (const code of ["BK007", "BK008", "BK009", "42501", "55000", "P0002", "XX000"]) {
      expect(JSON.stringify(mapMoveError(error(code, "pending"), "confirmed"))).not.toContain("relation");
    }
  });

  it("should give an unknown error the internal error of the other booking actions", () => {
    expect(mapMoveError(error("XX000"), "confirmed").code).toBe("INTERNAL_ERROR");
  });
});
