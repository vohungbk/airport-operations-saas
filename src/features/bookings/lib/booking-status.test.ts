import { describe, expect, it } from "vitest";

import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  BOOKING_STATUS_LABEL,
  getAllowedManualTransitions,
  isBookingEditable,
  isPartnerBookingEditable,
  isReasonRequired,
} from "@/features/bookings/lib/booking-status";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

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

  it.each(["preparation", "ready", "assigned", "en_route", "installed", "family_ready", "in_progress"] as const)(
    "should allow %s to be cancelled and nothing else",
    (status) => {
      expect(getAllowedManualTransitions(status)).toEqual(["cancelled"]);
    },
  );

  it("should offer no manual transition from terminal statuses", () => {
    for (const status of ["returned", "cleaning", "inspection", "completed", "cancelled", "no_show"] as const) {
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
  it("should hold a seat from New to Active Rental, and no longer once the rental is returned", () => {
    expect([...ACTIVE_BOOKING_STATUSES]).toEqual([
      "pending",
      "confirmed",
      "preparation",
      "ready",
      "assigned",
      "en_route",
      "installed",
      "family_ready",
      "in_progress",
    ]);
  });

  it("should name the 13 steps of the path, in order, with the names of the design", () => {
    expect(BOOKING_BOARD_STEPS.map((status) => BOOKING_STATUS_LABEL[status])).toEqual([
      "New",
      "Allocated",
      "Preparation",
      "Ready",
      "Technician Assigned",
      "En Route",
      "Installed",
      "Family Ready",
      "Active Rental",
      "Returned",
      "Cleaning",
      "Inspection",
      "Available",
    ]);
  });
});

describe("isPartnerBookingEditable (VI-F03-S03)", () => {
  it("should let a partner user edit only a pending booking", () => {
    for (const status of BOOKING_STATUSES) {
      expect(isPartnerBookingEditable(status)).toBe(status === "pending");
    }
  });

  it("should be narrower than what managers can edit", () => {
    for (const status of BOOKING_STATUSES) {
      if (isPartnerBookingEditable(status)) {
        expect(isBookingEditable(status)).toBe(true);
      }
    }
    expect(isBookingEditable("confirmed")).toBe(true);
    expect(isPartnerBookingEditable("confirmed")).toBe(false);
  });
});
