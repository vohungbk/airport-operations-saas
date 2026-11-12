import { describe, expect, it } from "vitest";

import {
  chainStepPhotoPath,
  chainStepPhotoStamp,
} from "@/features/return-queue/lib/chain-step-photos";

describe("chain step photos", () => {
  it.each([
    ["image/jpeg", "b-1/cleaning/p-1.jpg"],
    ["image/png", "b-1/cleaning/p-1.png"],
  ])("should store a %s photo in the folder of the booking and step", (type, path) => {
    expect(chainStepPhotoPath("b-1", "cleaning", "p-1", type)).toBe(path);
  });

  it("should show the seat, the airport and the date in the airport time zone", () => {
    expect(
      chainStepPhotoStamp("SEAT-0001", "DXB", new Date("2026-11-03T21:00:00Z"), "Asia/Dubai"),
    ).toBe("SEAT-0001 · DXB · 04 Nov 2026");
  });
});
