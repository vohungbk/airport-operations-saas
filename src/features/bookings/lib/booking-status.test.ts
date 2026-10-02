import { describe, expect, it } from "vitest";

import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  getAllowedManualTransitions,
  isBookingEditable,
  isReasonRequired,
} from "@/features/bookings/lib/booking-status";

describe("getAllowedManualTransitions", () => {
  it("should allow pending to become confirmed or cancelled", () => {
    expect(getAllowedManualTransitions("pending")).toEqual([
      "confirmed",
      "cancelled",
    ]);
  });

  it("should allow confirmed to become cancelled or no_show", () => {
    expect(getAllowedManualTransitions("confirmed")).toEqual([
      "cancelled",
      "no_show",
    ]);
  });

  it("should not allow pending to become no_show", () => {
    expect(getAllowedManualTransitions("pending")).not.toContain("no_show");
  });

  it("should offer no manual transition from terminal or workflow-owned statuses", () => {
    for (const status of [
      "assigned",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
    ] as const) {
      expect(getAllowedManualTransitions(status)).toEqual([]);
    }
  });

  it("should define a transition entry for every status", () => {
    for (const status of BOOKING_STATUSES) {
      expect(getAllowedManualTransitions(status)).toBeDefined();
    }
  });
});

describe("isReasonRequired", () => {
  it("should require a reason for cancelled and no_show only", () => {
    expect(isReasonRequired("cancelled")).toBe(true);
    expect(isReasonRequired("no_show")).toBe(true);
    expect(isReasonRequired("confirmed")).toBe(false);
  });
});

describe("isBookingEditable", () => {
  it("should allow editing pending and confirmed bookings only", () => {
    expect(isBookingEditable("pending")).toBe(true);
    expect(isBookingEditable("confirmed")).toBe(true);
    expect(isBookingEditable("cancelled")).toBe(false);
    expect(isBookingEditable("completed")).toBe(false);
    expect(isBookingEditable("assigned")).toBe(false);
  });
});

describe("ACTIVE_BOOKING_STATUSES", () => {
  it("should hold a seat for pending, confirmed, assigned and in_progress only", () => {
    expect([...ACTIVE_BOOKING_STATUSES]).toEqual([
      "pending",
      "confirmed",
      "assigned",
      "in_progress",
    ]);
  });
});
