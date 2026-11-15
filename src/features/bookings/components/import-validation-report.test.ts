import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ImportSuccess } from "@/features/bookings/components/import-success";
import { ImportValidating } from "@/features/bookings/components/import-validating";
import {
  IMPORT_REPORT_ROW_LIMIT,
  ImportValidationReport,
} from "@/features/bookings/components/import-validation-report";
import type { ImportReport, ImportRowResult } from "@/features/bookings/lib/validate-import-rows";

const FILE = { name: "bookings_dxb_07-nov-2026.csv", size: 29_081 };

const row = (number: number, error: string | null = null): ImportRowResult => ({
  row_number: number,
  external_booking_number: `EXT-${number}`,
  pickup_time: "8 Nov 2026, 09:30",
  flight_number: "EK 203",
  seat_category: "Infant",
  status: error ? "error" : "valid",
  error,
});

const report = (rows: ImportRowResult[]): ImportReport => {
  const invalid = rows.filter((item) => item.status === "error").length;
  return {
    total: rows.length,
    valid: rows.length - invalid,
    invalid,
    partner_name: "Emirates Rent A Car",
    timezone: "Asia/Dubai",
    rows,
  };
};

const render = (value: ImportReport, extra: Partial<Parameters<typeof ImportValidationReport>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ImportValidationReport, {
      file: FILE,
      report: value,
      onReplaceFile: () => undefined,
      onConfirm: () => undefined,
      ...extra,
    }),
  );

describe("ImportValidationReport (CO-F07-S03, R1)", () => {
  it("should show the counts, the file, the way on and every error row before anything is saved", () => {
    const html = render(report([row(1), row(2, "Seat category not found"), row(3)]));

    expect(html).toContain("3 rows");
    expect(html).toContain("2 valid");
    expect(html).toContain("1 with errors");
    expect(html).toContain("Emirates Rent A Car");
    expect(html).toContain("bookings_dxb_07-nov-2026.csv · 28.4 KB");
    expect(html).toContain("Seat category not found");
    expect(html).toContain("Fix the file and upload again, or import valid rows only");
    expect(html).toContain("Confirm import will create 2 bookings. The 1 rows with errors will be excluded.");
    expect(html).toContain("Replace file");
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Confirm import<\/button>/);
  });

  it("should name a duplicate row as a duplicate", () => {
    const html = render(report([row(1), { ...row(2, "Duplicate external booking number"), status: "duplicate" }]));

    expect(html).toContain("Duplicate");
    expect(html).toContain("Duplicate external booking number");
  });

  it("should lock the table and the buttons and say so while the valid rows are created", () => {
    const html = render(report([row(1), row(2, "Seat category not found")]), { importing: true });

    expect(html).toContain("Importing valid rows...");
    expect(html).toContain("Creating 1 bookings · 1 rows with errors excluded");
    expect(html).toContain("Table locked while importing");
    expect(html).toContain("Do not close this page until the import finishes.");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>(<svg[\s\S]*?<\/svg>)?Importing\.\.\.<\/button>/);
  });

  it("should say why a confirmation failed and offer to try again", () => {
    const html = render(report([row(1)]), { failureCode: "IMPORT_FAILED" });

    expect(html).toContain("Import failed");
    expect(html).toContain("Retry");
  });

  it("should say that every row is valid when none has an error", () => {
    const html = render(report([row(1), row(2)]));

    expect(html).toContain("All 2 rows are valid");
    expect(html).toContain("Confirm to create 2 bookings for this partner.");
    expect(html).toContain("No corrections needed");
  });

  it("should say that nothing can be created when no row is valid", () => {
    const html = render(report([row(1, "Seat category not found")]));

    expect(html).toContain("Fix the file and upload it again");
    expect(html).toContain("None of the rows passed validation");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Confirm import<\/button>/);
  });

  it("should show at most the row limit and say how many rows there are", () => {
    const rows = Array.from({ length: IMPORT_REPORT_ROW_LIMIT + 10 }, (_, index) => row(index + 1));

    expect(render(report(rows))).toContain(`Showing ${IMPORT_REPORT_ROW_LIMIT} of ${rows.length} rows`);
  });
});

describe("ImportValidating (CO-F07-S03)", () => {
  it("should lock the partner and say that no booking has been created while the rows are checked", () => {
    const html = renderToStaticMarkup(createElement(ImportValidating, { partnerLabel: "Emirates Rent A Car", file: FILE }));

    expect(html).toContain("Emirates Rent A Car");
    expect(html).toContain("Checking file");
    expect(html).toContain("Validating rows...");
    expect(html).toContain("No bookings have been created");
    expect(html).toContain('aria-busy="true"');
  });
});

describe("ImportSuccess (CO-F07-S05)", () => {
  const result = {
    total: 120,
    created: 112,
    excluded: 8,
    partner_name: "Emirates Rent A Car",
    timezone: "Asia/Dubai",
    completed_at: "2026-11-07T05:42:00.000Z",
    imported_by: "Priya Nair",
    file_name: "bookings_dxb_07-nov-2026.csv",
    file_size: 29_081,
  };

  it("should say how many bookings were created and how many rows were left out, and who imported them", () => {
    const html = renderToStaticMarkup(createElement(ImportSuccess, { result }));

    expect(html).toContain("112 bookings created");
    expect(html).toContain("8 rows with errors were excluded");
    expect(html).toContain("Priya Nair");
    expect(html).toContain("A record of this import has been saved.");
    expect(html).toContain("07 Nov 2026, 09:42");
    expect(html).toMatch(/<a[^>]*href="\/bookings\/import\/history"[^>]*>View import history<\/a>/);
  });

  it("should not talk about excluded rows when none was left out", () => {
    const html = renderToStaticMarkup(createElement(ImportSuccess, { result: { ...result, created: 120, excluded: 0 } }));

    expect(html).toContain("120 bookings created");
    expect(html).not.toContain("were excluded");
  });
});
