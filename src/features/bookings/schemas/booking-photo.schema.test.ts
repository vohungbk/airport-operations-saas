import { describe, expect, it } from "vitest";

import { recordBookingPhotoSchema } from "@/features/bookings/schemas/booking-photo.schema";

const BOOKING_ID = "b0000000-0000-0000-0000-000000000123";
const VALID = { booking_id: BOOKING_ID, type: "installation", storage_path: `${BOOKING_ID}/installation/p-1.jpg`, caption: "Seat fitted" };

describe("recordBookingPhotoSchema", () => {
  it("should accept a photo in the folder of its booking and type with a caption of 200 characters", () => {
    expect(recordBookingPhotoSchema.safeParse({ ...VALID, caption: "a".repeat(200) }).success).toBe(true);
  });

  it("should accept a photo without a caption", () => {
    const result = recordBookingPhotoSchema.safeParse({ ...VALID, caption: undefined });

    expect(result.success && result.data.caption).toBe("");
  });

  it.each([
    ["a caption over 200 characters", { caption: "a".repeat(201) }, "The caption must be at most 200 characters."],
    ["no path", { storage_path: "" }, "Add a photo."],
    ["a path of another booking", { storage_path: "other/installation/p-1.jpg" }, "Add a photo."],
    ["a path of another type", { storage_path: `${BOOKING_ID}/incident/p-1.jpg` }, "Add a photo."],
    ["a path that climbs out of the folder", { storage_path: `${BOOKING_ID}/installation/../x.jpg` }, "Add a photo."],
  ])("should reject %s", (_name, change, message) => {
    const result = recordBookingPhotoSchema.safeParse({ ...VALID, ...change });

    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toBe(message);
  });
});
