import { describe, expect, it } from "vitest";

import { invoicePdfFileName } from "@/features/invoices/lib/invoice-pdf-file-name";

describe("invoicePdfFileName", () => {
  it("should name the file after the number of the invoice", () => {
    expect(invoicePdfFileName("INV-2026-000045")).toBe("INV-2026-000045.pdf");
  });

  it.each([
    ['a quote and a slash', 'INV"/../x', "INV__.._x.pdf"],
    ["a line break", "INV\r\nSet-Cookie: x", "INV__Set-Cookie__x.pdf"],
    ["a space", "INV 1", "INV_1.pdf"],
  ])("should make %s safe in the name of a file", (_name, number, expected) => {
    expect(invoicePdfFileName(number)).toBe(expected);
  });
});
