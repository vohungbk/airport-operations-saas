import { describe, expect, it } from "vitest";

import {
  BOOKING_IMPORT_TEMPLATE_COLUMNS,
  buildBookingImportTemplateCsv,
} from "@/features/bookings/lib/booking-import-template";

describe("booking import template (CO-F07-S01, R3)", () => {
  it("should hold only the header row with every booking column", () => {
    const csv = buildBookingImportTemplateCsv();

    expect(csv).toBe(`${BOOKING_IMPORT_TEMPLATE_COLUMNS.join(",")}\r\n`);
    expect(csv.trim().split("\r\n")).toHaveLength(1);
  });

  it("should name the columns the import maps (R7) with no repeated column", () => {
    expect(BOOKING_IMPORT_TEMPLATE_COLUMNS).toEqual(
      expect.arrayContaining([
        "external_booking_number",
        "pickup_time",
        "return_time",
        "flight_number",
        "seat_category",
        "child_age_band",
        "vehicle",
        "notes",
      ]),
    );
    expect(new Set(BOOKING_IMPORT_TEMPLATE_COLUMNS).size).toBe(BOOKING_IMPORT_TEMPLATE_COLUMNS.length);
  });
});
