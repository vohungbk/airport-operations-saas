import { describe, expect, it } from "vitest";

import { formatFileSize, isCsvFile } from "@/features/bookings/lib/csv-file";

describe("csv file (CO-F07-S01)", () => {
  it.each([
    ["bookings_dxb_07-nov-2026.csv", true],
    ["BOOKINGS.CSV", true],
    ["bookings.xlsx", false],
    ["bookings.csv.exe", false],
    ["csv", false],
  ])("should answer %s is a CSV: %s", (name, expected) => {
    expect(isCsvFile({ name })).toBe(expected);
  });

  it.each([
    [512, "512 B"],
    [29081, "28.4 KB"],
    [1024 * 1024 * 1.5, "1.5 MB"],
  ])("should show %d bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
