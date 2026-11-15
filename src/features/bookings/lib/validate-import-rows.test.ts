import { describe, expect, it } from "vitest";

import {
  DUPLICATE_ROW_ERROR,
  buildImportPlan,
  buildImportReport,
  filterImportRows,
  validateImportRow,
  type ImportRowLookups,
} from "@/features/bookings/lib/validate-import-rows";

const lookups: ImportRowLookups = {
  partnerId: "a0000000-0000-0000-0000-000000000001",
  airportId: "b0000000-0000-0000-0000-000000000001",
  categoryIdsByName: new Map([
    ["infant", "c0000000-0000-0000-0000-000000000001"],
    ["toddler", "c0000000-0000-0000-0000-000000000002"],
  ]),
};

// external_booking_number, pickup_time, return_time, flight_number, seat_category, child_age_band, vehicle, notes, rate
const ROW = ["EXT-1", "2026-11-08 09:30", "2026-11-10 09:30", "EK 203", "Infant", "0-12 months", "Sedan", "", "45.50"];
const row = (changes: Record<number, string> = {}) => ROW.map((cell, index) => changes[index] ?? cell);
const check = (cells: string[]) => validateImportRow(cells, 1, lookups);

describe("validateImportRow (CO-F07-S03, R7, R8)", () => {
  it("should accept a row that the manual form would accept, and map its columns for the report", () => {
    expect(check(ROW)).toEqual({
      row_number: 1,
      external_booking_number: "EXT-1",
      pickup_time: "8 Nov 2026, 09:30",
      flight_number: "EK 203",
      seat_category: "Infant",
      status: "valid",
      error: null,
    });
  });

  it.each([
    ["a time with a T", row({ 1: "2026-11-08T09:30" })],
    ["a category in other letters", row({ 4: "TODDLER" })],
    ["no flight, age band or notes", row({ 3: "", 5: "", 7: "" })],
  ])("should accept %s", (_label, cells) => {
    expect(check(cells).status).toBe("valid");
  });

  it.each([
    ["a category that is not in use", row({ 4: "Premium" }), "Seat category not found"],
    ["no category", row({ 4: "" }), "Seat category is required."],
    ["a pickup that is not a date", row({ 1: "31 Nov 2026" }), "Pickup must be a valid date and time."],
    ["a return before the pickup", row({ 2: "2026-11-07 09:30" }), "Return must not be before pickup."],
    ["a rate that is not a number", row({ 8: "abc" }), "Daily price must be a number with up to 2 decimals."],
    ["a rate of zero", row({ 8: "0" }), "Daily price must be greater than 0."],
    ["a flight number with a symbol", row({ 3: "EK-203" }), "Flight number must be 2 to 8 letters or digits."],
    ["an age band the form does not offer", row({ 5: "10 years" }), "Child age band must be one of 0-12 months · 12-24 months · 24-48 months · 4-8 years"],
    ["more columns than the template", [...ROW, "extra"], "Row has more columns than the template"],
  ])("should refuse %s", (_label, cells, message) => {
    const result = check(cells);

    expect(result.status).toBe("error");
    expect(result.error).toBe(message);
  });

  it("should refuse a row with fewer cells than the template and say what is missing", () => {
    expect(check(["EXT-1"])).toMatchObject({ status: "error", error: "Seat category is required." });
  });
});

describe("buildImportReport and filterImportRows (CO-F07-S03, R1)", () => {
  const report = buildImportReport([ROW, row({ 4: "Premium" }), row({ 0: "EXT-2" })], lookups, {
    partnerName: "Emirates Rent A Car",
    timezone: "Asia/Dubai",
  });

  it("should count the rows of the file, the valid ones and the ones with errors", () => {
    expect(report).toMatchObject({ total: 3, valid: 2, invalid: 1, partner_name: "Emirates Rent A Car", timezone: "Asia/Dubai" });
    expect(report.rows.map((item) => item.row_number)).toEqual([1, 2, 3]);
  });

  it.each([
    ["all", 3, [1, 2, 3]],
    ["valid", 2, [1, 3]],
    ["error", 1, [2]],
  ] as const)("should show the %s rows of the report", (filter, matching, numbers) => {
    const shown = filterImportRows(report.rows, filter, 50);

    expect(shown.matching).toBe(matching);
    expect(shown.rows.map((item) => item.row_number)).toEqual(numbers);
  });

  it("should show no more rows than the limit and still count all that match", () => {
    const shown = filterImportRows(report.rows, "all", 2);

    expect(shown.rows).toHaveLength(2);
    expect(shown.matching).toBe(3);
  });
});

describe("buildImportPlan (CO-F07-S04, S05, R9)", () => {
  const context = { partnerName: "Emirates Rent A Car", timezone: "Asia/Dubai" };
  const plan = (rows: string[][], existing: string[] = []) =>
    buildImportPlan(rows, lookups, { ...context, existingExternalNumbers: new Set(existing) });

  it("should refuse a row whose external booking number the partner already has, as a duplicate", () => {
    const { report, rows } = plan([ROW, row({ 0: "EXT-9" })], ["EXT-1"]);

    expect(report.rows.map((item) => [item.status, item.error])).toEqual([
      ["duplicate", DUPLICATE_ROW_ERROR],
      ["valid", null],
    ]);
    expect(rows.map((item) => item.external_booking_number)).toEqual(["EXT-9"]);
  });

  it("should refuse the later of two rows of the file that repeat a number, and keep the first", () => {
    const { report, rows } = plan([ROW, ROW]);

    expect(report.rows.map((item) => item.status)).toEqual(["valid", "duplicate"]);
    expect(rows.map((item) => item.row_number)).toEqual([1]);
  });

  it("should not take a row with an error as the first one that holds a number", () => {
    const { report } = plan([row({ 4: "Premium" }), ROW]);

    expect(report.rows.map((item) => item.status)).toEqual(["error", "valid"]);
  });

  it("should never call a row without an external booking number a duplicate", () => {
    const { report } = plan([row({ 0: "" }), row({ 0: "" })], [""]);

    expect(report.rows.map((item) => item.status)).toEqual(["valid", "valid"]);
  });

  it("should count the duplicates with the rows that are not imported", () => {
    const { report } = plan([ROW, ROW, row({ 0: "EXT-3", 4: "Premium" })]);

    expect(report).toMatchObject({ total: 3, valid: 1, invalid: 2 });
    expect(filterImportRows(report.rows, "error", 50).matching).toBe(2);
    expect(filterImportRows(report.rows, "valid", 50).matching).toBe(1);
  });

  it("should give each valid row to the database at the time of the airport, in UTC", () => {
    const { rows } = plan([ROW]);

    expect(rows).toEqual([
      {
        row_number: 1,
        seat_category_id: "c0000000-0000-0000-0000-000000000001",
        // Dubai is UTC+4 all year: 09:30 there is 05:30 UTC.
        pickup_at: "2026-11-08T05:30:00.000Z",
        return_at: "2026-11-10T05:30:00.000Z",
        daily_rate: 45.5,
        external_booking_number: "EXT-1",
        child_age_band: "0-12 months",
        vehicle: "Sedan",
        notes: undefined,
      },
    ]);
  });
});
