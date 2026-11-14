import { describe, expect, it } from "vitest";

import { isBookingPhotoForbiddenError, mapBookingPhotoError } from "@/features/bookings/lib/booking-photo-errors";

describe("isBookingPhotoForbiddenError", () => {
  it.each([
    ["the forbidden() signal of the action", { digest: "NEXT_HTTP_ERROR_FALLBACK;403" }],
    ["a 403 status from the bucket", { status: 403 }],
    ["a 403 status code from the bucket", { statusCode: "403" }],
  ])("should be true for %s", (_name, error) => {
    expect(isBookingPhotoForbiddenError(error)).toBe(true);
  });

  it.each([
    ["a network failure", new TypeError("Failed to fetch")],
    ["a not found signal", { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }],
    ["a server error", { status: 500, statusCode: "500" }],
    ["nothing", null],
  ])("should be false for %s", (_name, error) => {
    expect(isBookingPhotoForbiddenError(error)).toBe(false);
  });
});

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
