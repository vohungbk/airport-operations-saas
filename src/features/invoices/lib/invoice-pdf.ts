import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { buildInvoiceDetail, type InvoiceDetailRow } from "@/features/invoices/lib/invoice-detail";

/** A4, in points. */
const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE.width - 2 * MARGIN;
const BOTTOM = 64;

const INK = rgb(0.09, 0.13, 0.2);
const MUTED = rgb(0.35, 0.4, 0.5);
const RED = rgb(0.69, 0.13, 0.13);
const BAND = rgb(0.92, 0.94, 0.97);
const RULE = rgb(0.82, 0.85, 0.9);

/** The two lines of the design that wait for the legal details of the company (spec Q2). */
export const PDF_PLACEHOLDER_LINES = [
  "Placeholder: company legal name and registered address",
  "Placeholder: VAT registration number",
] as const;

/**
 * The text as a font of the PDF can write it. The standard fonts hold the Western European characters
 * (WinAnsi); one that is not there is written as `?` instead of failing the whole document.
 */
export function pdfSafeText(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());

  return Array.from(text.replace(/[\r\n\t]+/g, " "))
    .map((char) => (supported.has(char.codePointAt(0) ?? -1) ? char : "?"))
    .join("");
}

/** Breaks a text into lines no wider than `width`, at spaces. A word wider than a line is kept whole. */
export function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;

    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  return line ? [...lines, line] : lines;
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
}

/** A page and the height left on it, which the document writes down from the top. */
class Cursor {
  page: PDFPage;
  y: number;

  constructor(private readonly doc: PDFDocument) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  /** Makes room for `height`; a new page when the page is full. */
  need(height: number) {
    if (this.y - height < BOTTOM) {
      this.page = this.doc.addPage([PAGE.width, PAGE.height]);
      this.y = PAGE.height - MARGIN;
    }
  }
}

/**
 * The invoice as a PDF document (VI-F09-S04), laid out as the document of the design: the title, the lines
 * that wait for the legal details of the company, the number, who is billed, the month and the dates, the lines
 * with the subtotal, the VAT and the total, and how the total is made up. It is built from the stored invoice
 * and from the same view the invoice detail uses, so the document and the screen cannot disagree. Pure but for
 * the PDF library; the bytes depend only on the invoice.
 */
export async function buildInvoicePdf(row: InvoiceDetailRow): Promise<Uint8Array> {
  // The partner is written on its own line (Bill to), so the line of the month and the dates leaves it out.
  const view = buildInvoiceDetail(row, false);
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  const safe = (text: string) => pdfSafeText(text, fonts.regular);
  const cursor = new Cursor(doc);

  // The metadata is the invoice's own, so the same invoice gives the same file.
  const issued = new Date(`${row.issue_date}T00:00:00Z`);
  doc.setTitle(safe(`Invoice ${row.invoice_number}`));
  doc.setCreator("Airport Operations");
  doc.setProducer("Airport Operations");
  doc.setCreationDate(issued);
  doc.setModificationDate(issued);

  const write = (text: string, options: { size: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number }) => {
    const font = options.font ?? fonts.regular;

    for (const line of wrapText(safe(text), font, options.size, CONTENT_WIDTH)) {
      cursor.need(options.size + 4);
      cursor.y -= options.size;
      cursor.page.drawText(line, { x: MARGIN, y: cursor.y, size: options.size, font, color: options.color ?? INK });
      cursor.y -= 4;
    }
    cursor.y -= options.gap ?? 0;
  };

  write("AIRPORT OPERATIONS / TAX INVOICE", { size: 13, font: fonts.bold, gap: 6 });
  for (const line of PDF_PLACEHOLDER_LINES) {
    write(line, { size: 9, color: MUTED });
  }
  cursor.y -= 14;

  write(row.invoice_number, { size: 24, font: fonts.bold, gap: 8 });
  write(`Bill to: ${row.partner?.name ?? "—"}`, { size: 10 });
  write(view.meta, { size: 10, gap: 4 });
  // An invoice that is not final says so on the document.
  if (row.status === "draft" || row.status === "void") {
    write(`Status: ${view.current.replace("Current: ", "")}`, { size: 10, font: fonts.bold, color: RED });
  }
  cursor.y -= 14;

  // The lines table: a band for the heads, a rule under each row, the amount at the right edge.
  const rowHeight = 22;
  cursor.need(rowHeight * 2);
  cursor.page.drawRectangle({ x: MARGIN, y: cursor.y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: BAND });
  cursor.page.drawText("Description", { x: MARGIN + 8, y: cursor.y - 15, size: 9, font: fonts.bold, color: MUTED });
  const headAmount = "Amount (USD)";
  cursor.page.drawText(headAmount, {
    x: MARGIN + CONTENT_WIDTH - 8 - fonts.bold.widthOfTextAtSize(headAmount, 9),
    y: cursor.y - 15,
    size: 9,
    font: fonts.bold,
    color: MUTED,
  });
  cursor.y -= rowHeight;

  for (const line of view.lines) {
    cursor.need(rowHeight);
    const font = line.is_total ? fonts.bold : fonts.regular;
    const amount = safe(line.amount);

    cursor.page.drawText(safe(line.description), { x: MARGIN + 8, y: cursor.y - 15, size: 10, font, color: INK });
    cursor.page.drawText(amount, {
      x: MARGIN + CONTENT_WIDTH - 8 - fonts.mono.widthOfTextAtSize(amount, 10),
      y: cursor.y - 15,
      size: 10,
      font: fonts.mono,
      color: line.negative ? RED : INK,
    });
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y - rowHeight },
      end: { x: MARGIN + CONTENT_WIDTH, y: cursor.y - rowHeight },
      thickness: 0.5,
      color: RULE,
    });
    cursor.y -= rowHeight;
  }
  cursor.y -= 16;

  if (view.explanation) {
    write(view.explanation, { size: 9, color: MUTED, gap: 8 });
  }

  return doc.save();
}
