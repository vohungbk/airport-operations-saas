import { describe, expect, it } from "vitest";

import { mapBookingPhotoError } from "@/features/bookings/lib/booking-photo-errors";

describe("mapBookingPhotoError", () => {
  it.each([
    ["P0002", "Booking not found", "NOT_FOUND"],
    ["22023", "A photo is required", "PHOTO_REQUIRED"],
    ["22023", "The caption must be at most 200 characters", "VALIDATION_ERROR"],
    ["22023", "The photo type is not valid", "VALIDATION_ERROR"],
    ["XX000", "boom: secret detail", "INTERNAL_ERROR"],
  ])("should map %s %s to %s without the raw message", (code, message, expected) => {
    const mapped = mapBookingPhotoError({ code, message });

    expect(mapped.code).toBe(expected);
    expect(mapped.message).not.toContain("secret");
  });
});
