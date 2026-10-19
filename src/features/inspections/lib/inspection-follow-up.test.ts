import { describe, expect, it } from "vitest";

import {
  inspectionFollowUpMessages,
  toInspectionFollowUp,
} from "@/features/inspections/lib/inspection-follow-up";

describe("toInspectionFollowUp", () => {
  it.each([["seat_quarantined"], ["seat_quarantined_active_booking"]])(
    "should keep the known follow-up %s",
    (value) => {
      expect(toInspectionFollowUp(value)).toBe(value);
    },
  );

  it.each([[null], [""], ["something_else"]])(
    "should return null for %j",
    (value) => {
      expect(toInspectionFollowUp(value)).toBeNull();
    },
  );
});

describe("inspectionFollowUpMessages", () => {
  it("should return no message when there is no follow-up", () => {
    expect(inspectionFollowUpMessages(null)).toEqual([]);
  });

  it("should say the seat was moved to quarantine", () => {
    expect(inspectionFollowUpMessages("seat_quarantined")).toEqual([
      "The seat was moved to quarantine.",
    ]);
  });

  it("should add the active booking warning when the seat is in an active booking", () => {
    expect(
      inspectionFollowUpMessages("seat_quarantined_active_booking"),
    ).toEqual([
      "The seat was moved to quarantine.",
      "This seat is in an active booking. Review the booking.",
    ]);
  });
});
