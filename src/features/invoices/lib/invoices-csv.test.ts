import { describe, expect, it } from "vitest";

import {
  CSV_BOM,
  buildInvoicesCsv,
  invoicesCsvFileName,
  plainAmount,
  textCell,
} from "@/features/invoices/lib/invoices-csv";
import type { InvoiceListRow } from "@/features/invoices/lib/invoice-list";

const ROW: InvoiceListRow = {
  id: "i-1",
  invoice_number: "INV-2026-000045",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-09-01",
  issue_date: "2026-09-30",
  due_date: "2026-11-15",
  total: 2400,
  status: "issued",
};

const lines = (csv: string) => csv.replace(CSV_BOM, "").split("\r\n").filter(Boolean);

describe("textCell (VI-F09-S02)", () => {
  it("should leave a plain text as it is", () => {
    expect(textCell("INV-2026-000045")).toBe("INV-2026-000045");
  });

  it.each([
    ["a comma", "Rent, A Car", '"Rent, A Car"'],
    ["a quote", 'The "Best" Cars', '"The ""Best"" Cars"'],
    ["a line break", "Rent\nA Car", '"Rent\nA Car"'],
  ])("should quote a text with %s", (_name, value, expected) => {
    expect(textCell(value)).toBe(expected);
  });

  it.each(["=SUM(A1:A9)", "+1+1", "-2+3", "@cmd", "\tx", "\rx"])(
    "should keep %j from being taken for a formula by a spreadsheet",
    (value) => {
      expect(textCell(value).replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );

  it("should quote a formula that also has a comma, with the guard inside the quotes", () => {
    expect(textCell("=A1,B1")).toBe(`"'=A1,B1"`);
  });
});

describe("plainAmount", () => {
  it("should write a number a spreadsheet can add up", () => {
    expect(plainAmount(2400)).toBe("2400.00");
    expect(plainAmount(1450.5)).toBe("1450.50");
    expect(plainAmount(0.1 + 0.2)).toBe("0.30");
    expect(plainAmount(-12.5)).toBe("-12.50");
    expect(plainAmount(-0.001)).toBe("0.00");
  });
});

describe("buildInvoicesCsv (VI-F09-S02, AC01)", () => {
  it("should start with the mark that makes Excel read UTF-8, and end each line with CRLF", () => {
    const csv = buildInvoicesCsv([ROW], true);

    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("should write the columns of the table, with the Partner column for the operations team", () => {
    expect(lines(buildInvoicesCsv([ROW], true))).toEqual([
      "Invoice number,Partner,Period,Amount (USD),Due date,Payment status",
      "INV-2026-000045,Emirates Rent A Car,2026-09,2400.00,2026-11-15,Issued",
    ]);
  });

  it("should leave the Partner column out for a partner user", () => {
    expect(lines(buildInvoicesCsv([ROW], false))).toEqual([
      "Invoice number,Period,Amount (USD),Due date,Payment status",
      "INV-2026-000045,2026-09,2400.00,2026-11-15,Issued",
    ]);
  });

  it("should give the header line alone when the list is empty", () => {
    expect(lines(buildInvoicesCsv([], false))).toEqual(["Invoice number,Period,Amount (USD),Due date,Payment status"]);
  });

  it("should leave the period and the partner empty for an invoice that has none", () => {
    expect(lines(buildInvoicesCsv([{ ...ROW, period_start: null, partner: null, status: "overdue" }], true))[1]).toBe(
      "INV-2026-000045,,,2400.00,2026-11-15,Overdue",
    );
  });

  it("should quote a partner name with a comma and guard a partner name that is a formula", () => {
    const csv = lines(
      buildInvoicesCsv(
        [
          { ...ROW, partner: { name: "Rent, A Car", code: "R" } },
          { ...ROW, id: "i-2", partner: { name: "=HYPERLINK(\"http://x\")", code: "X" } },
        ],
        true,
      ),
    );

    expect(csv[1]).toContain('"Rent, A Car"');
    expect(csv[2]).toContain("\"'=HYPERLINK(\"\"http://x\"\")\"");
  });

  it("should not put a minus sign in an amount through the formula guard", () => {
    expect(lines(buildInvoicesCsv([{ ...ROW, total: -50 }], false))[1]).toContain(",-50.00,");
  });
});

describe("invoicesCsvFileName", () => {
  it("should name the file after the day of the export", () => {
    expect(invoicesCsvFileName("2026-10-30")).toBe("invoices-2026-10-30.csv");
  });
});
