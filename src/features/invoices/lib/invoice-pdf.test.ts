import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";

import type { InvoiceDetailRow } from "@/features/invoices/lib/invoice-detail";
import {
  PDF_PLACEHOLDER_LINES,
  buildInvoicePdf,
  pdfSafeText,
  wrapText,
} from "@/features/invoices/lib/invoice-pdf";

const LINES: InvoiceDetailRow["lines"] = [
  { position: 1, description: "Gross revenue", amount: 8000, counts_toward_subtotal: false },
  { position: 2, description: "Partner share", amount: 4800, counts_toward_subtotal: false },
  { position: 3, description: "Platform share", amount: 3200, counts_toward_subtotal: true },
  { position: 4, description: "Refunds (credit)", amount: -150, counts_toward_subtotal: true },
  { position: 5, description: "Onboarding credits", amount: -500, counts_toward_subtotal: true },
  { position: 6, description: "Annual programme fee", amount: 2500, counts_toward_subtotal: true },
];

const ROW: InvoiceDetailRow = {
  id: "i-1",
  invoice_number: "INV-2026-000045",
  issue_date: "2026-10-01",
  due_date: "2026-10-31",
  subtotal: 5050,
  vat: 252.5,
  total: 5302.5,
  status: "issued",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-09-01",
  lines: LINES,
};

/** The strings the document draws, in the order it draws them (the standard fonts write them as hex). */
async function drawnText(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const out: string[] = [];

  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents];

    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      const operators = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");

      for (const match of operators.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
        out.push(Buffer.from(match[1], "hex").toString("latin1"));
      }
    }
  }

  return out;
}

describe("buildInvoicePdf (VI-F09-S04, AC02)", () => {
  it("should give a PDF document", async () => {
    const bytes = await buildInvoicePdf(ROW);

    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(Buffer.from(bytes.slice(-6)).toString()).toContain("%%EOF");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("should show the number, who is billed, the month and both dates", async () => {
    const text = (await drawnText(await buildInvoicePdf(ROW))).join("\n");

    expect(text).toContain("AIRPORT OPERATIONS / TAX INVOICE");
    expect(text).toContain("INV-2026-000045");
    expect(text).toContain("Bill to: Emirates Rent A Car");
    expect(text).toContain("September 2026 / Issued 01 Oct 2026 / Due 31 Oct 2026");
  });

  it("should show every line, then the subtotal, the VAT with its rate, and the total", async () => {
    const text = await drawnText(await buildInvoicePdf(ROW));

    for (const expected of [
      "Platform share",
      "$3,200.00",
      "Refunds (credit)",
      "-$150.00",
      "Annual programme fee",
      "$2,500.00",
      "Subtotal",
      "$5,050.00",
      "VAT 5%",
      "$252.50",
      "Total USD",
      "$5,302.50",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("should say how the total is calculated, in the words of the invoice detail", async () => {
    const text = (await drawnText(await buildInvoicePdf(ROW))).join(" ");

    expect(text).toContain("How this total is calculated: 3,200.00 platform share");
    expect(text).toContain("= USD 5,302.50.");
  });

  it("should keep the two lines that wait for the legal details of the company, labelled as placeholders", async () => {
    const text = await drawnText(await buildInvoicePdf(ROW));

    for (const line of PDF_PLACEHOLDER_LINES) {
      expect(text).toContain(line);
    }
    expect(PDF_PLACEHOLDER_LINES.every((line) => line.startsWith("Placeholder:"))).toBe(true);
  });

  it("should name the status of an invoice that is not final, and say nothing of the status of one that is", async () => {
    expect(await drawnText(await buildInvoicePdf({ ...ROW, status: "draft" }))).toContain("Status: Draft");
    expect(await drawnText(await buildInvoicePdf({ ...ROW, status: "void" }))).toContain("Status: Void");
    expect((await drawnText(await buildInvoicePdf(ROW))).some((line) => line.startsWith("Status:"))).toBe(false);
  });

  it("should still give a document, with the figures of the invoice, when it has no lines", async () => {
    const text = await drawnText(await buildInvoicePdf({ ...ROW, lines: [] }));

    expect(text).toContain("Total USD");
    expect(text).toContain("$5,302.50");
  });

  it("should write a character that the font does not hold as a question mark, not fail", async () => {
    const text = await drawnText(await buildInvoicePdf({ ...ROW, partner: { name: "北京 Rent, Ünï", code: "X" } }));

    expect(text).toContain("Bill to: ?? Rent, Ünï");
  });

  it("should go on to a second page when the lines do not fit on one", async () => {
    const many = Array.from({ length: 60 }, (_, index) => ({
      position: index + 1,
      description: `Line ${index + 1}`,
      amount: 1,
      counts_toward_subtotal: true,
    }));

    const doc = await PDFDocument.load(await buildInvoicePdf({ ...ROW, subtotal: 60, vat: 3, total: 63, lines: many }));

    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("should give the same file for the same invoice, with the invoice's own title and date as metadata", async () => {
    const [first, second] = await Promise.all([buildInvoicePdf(ROW), buildInvoicePdf(ROW)]);
    const doc = await PDFDocument.load(first);

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(doc.getTitle()).toBe("Invoice INV-2026-000045");
    expect(doc.getCreationDate()?.toISOString().slice(0, 10)).toBe("2026-10-01");
  });
});

describe("pdfSafeText and wrapText", () => {
  it("should keep what the font holds and replace what it does not", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    expect(pdfSafeText("Café — €5\r\nnext", font)).toBe("Café — €5 next");
    expect(pdfSafeText("漢字", font)).toBe("??");
  });

  it("should break a text at spaces so that no line is wider than the width, and keep a long word whole", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("one two three four five six seven eight nine ten", font, 10, 80);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => font.widthOfTextAtSize(line, 10) <= 80)).toBe(true);
    expect(lines.join(" ")).toBe("one two three four five six seven eight nine ten");
    expect(wrapText("supercalifragilisticexpialidocious", font, 10, 40)).toEqual(["supercalifragilisticexpialidocious"]);
  });
});

