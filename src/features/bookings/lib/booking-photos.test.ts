import { describe, expect, it } from "vitest";

import {
  BOOKING_PHOTO_MAX_BYTES,
  bookingPhotoPath,
  captionFromFileName,
  filterBookingPhotos,
  stepPhotoIndex,
  validatePhotoFile,
  type BookingPhoto,
} from "@/features/bookings/lib/booking-photos";
import { PHOTO_MAX_BYTES } from "@/lib/field/photo-upload";

const photo = (id: string, type: BookingPhoto["type"]): BookingPhoto => ({
  id,
  url: `https://example.test/${id}.jpg`,
  caption: null,
  type,
  uploader_name: null,
  taken_at: null,
});

describe("validatePhotoFile", () => {
  it("should accept a JPG or PNG under 10 MB", () => {
    expect(validatePhotoFile({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validatePhotoFile({ name: "a.png", type: "image/png", size: PHOTO_MAX_BYTES })).toBeNull();
  });

  it("should reject a file that is not a JPG or PNG", () => {
    expect(validatePhotoFile({ name: "a.gif", type: "image/gif", size: 10 })).toBe("a.gif is not a JPG or PNG photo.");
  });

  it("should reject a file larger than 10 MB", () => {
    expect(validatePhotoFile({ name: "big.png", type: "image/png", size: PHOTO_MAX_BYTES + 1 })).toBe(
      "big.png is larger than 10 MB.",
    );
  });
});

describe("validatePhotoFile for a booking photo (2 MB)", () => {
  it.each([
    ["a JPG of exactly 2 MB", "image/jpeg", BOOKING_PHOTO_MAX_BYTES, null],
    ["a PNG over 2 MB", "image/png", BOOKING_PHOTO_MAX_BYTES + 1, "big.png is larger than 2 MB."],
    ["a GIF", "image/gif", 10, "big.png is not a JPG or PNG photo."],
  ])("should handle %s", (_name, type, size, expected) => {
    expect(validatePhotoFile({ name: "big.png", type, size }, BOOKING_PHOTO_MAX_BYTES)).toBe(expected);
  });
});

describe("bookingPhotoPath", () => {
  it("should put the photo in the folder of its booking and type with the extension of its content", () => {
    expect(bookingPhotoPath("b-1", "incident", "p-1", "image/png")).toBe("b-1/incident/p-1.png");
    expect(bookingPhotoPath("b-1", "installation", "p-2", "image/jpeg")).toBe("b-1/installation/p-2.jpg");
  });
});

describe("captionFromFileName", () => {
  it.each([
    ["seat-front.jpg", "seat-front"],
    ["IMG 1.final.png", "IMG 1.final"],
    ["noextension", "noextension"],
    [`${"a".repeat(250)}.jpg`, "a".repeat(200)],
  ])("should turn %s into a caption: %s", (name, expected) => {
    expect(captionFromFileName(name)).toBe(expected);
  });
});

describe("filterBookingPhotos", () => {
  const photos = [photo("1", "installation"), photo("2", "return"), photo("3", "installation")];

  it("should return every photo for All", () => {
    expect(filterBookingPhotos(photos, "all")).toHaveLength(3);
  });

  it("should return only the photos of the chosen type", () => {
    expect(filterBookingPhotos(photos, "installation").map((p) => p.id)).toEqual(["1", "3"]);
    expect(filterBookingPhotos(photos, "incident")).toEqual([]);
  });
});

describe("stepPhotoIndex", () => {
  it.each([
    [0, 3, 1, 1],
    [2, 3, 1, 0],
    [0, 3, -1, 2],
    [0, 0, 1, 0],
  ] as const)("should move %i of %i by %i to %i", (index, count, direction, expected) => {
    expect(stepPhotoIndex(index, count, direction)).toBe(expected);
  });
});
