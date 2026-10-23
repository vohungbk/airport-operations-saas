import { describe, expect, it } from "vitest";

import { SEAT_QR_PAGE_METADATA } from "@/features/seats/lib/seat-qr-metadata";

describe("SEAT_QR_PAGE_METADATA", () => {
  it("should keep the scan page out of search indexes", () => {
    expect(SEAT_QR_PAGE_METADATA.robots).toEqual({ index: false, follow: false });
  });

  it("should send no Referer, so the token in the address does not leave the app", () => {
    expect(SEAT_QR_PAGE_METADATA.referrer).toBe("no-referrer");
  });
});
