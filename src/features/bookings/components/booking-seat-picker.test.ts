import { describe, expect, it } from "vitest";

import type { AvailableSeat } from "@/features/bookings/actions/get-available-seats.action";
import {
  isSeatSelectable,
  seatStateText,
} from "@/features/bookings/components/booking-seat-picker";

const SEAT: AvailableSeat = {
  id: "s1",
  serial_number: "SEAT-0001",
  availability: "available",
  conflict_booking_number: null,
  unusable_reason: null,
};

describe("seat picker rows", () => {
  it("should say Available and allow an available seat", () => {
    expect(seatStateText(SEAT)).toBe("Available");
    expect(isSeatSelectable(SEAT)).toBe(true);
  });

  it("should show the conflicting booking number and block a seat in conflict", () => {
    const seat = {
      ...SEAT,
      availability: "conflict" as const,
      conflict_booking_number: "BK-2026-000123",
    };

    expect(seatStateText(seat)).toBe("Conflict · BK-2026-000123");
    expect(isSeatSelectable(seat)).toBe(false);
  });

  it("should show the reason and block a seat that is not usable", () => {
    const seat = {
      ...SEAT,
      availability: "not_usable" as const,
      unusable_reason: "Seat status: cleaning",
    };

    expect(seatStateText(seat)).toBe("Seat status: cleaning");
    expect(isSeatSelectable(seat)).toBe(false);
  });
});
