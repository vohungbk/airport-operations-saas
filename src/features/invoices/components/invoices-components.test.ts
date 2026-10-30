import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { InvoiceDetail } from "@/features/invoices/components/invoice-detail";
import { InvoicesEmpty } from "@/features/invoices/components/invoices-empty";
import { InvoicesFilters } from "@/features/invoices/components/invoices-filters";
import { InvoicesPagination } from "@/features/invoices/components/invoices-pagination";
import { InvoicesTable } from "@/features/invoices/components/invoices-table";
import { buildInvoiceDetail } from "@/features/invoices/lib/invoice-detail";
import { buildInvoiceRows, type InvoiceListRow } from "@/features/invoices/lib/invoice-list";
import { invoicesQuerySchema, resolveInvoicesQuery } from "@/features/invoices/schemas/invoices-query.schema";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);
const query = (raw: Record<string, string>, isPartner: boolean) => resolveInvoicesQuery(invoicesQuerySchema.parse(raw), isPartner);

const ROWS: InvoiceListRow[] = [
  { id: "i-1", invoice_number: "INV-2026-000045", partner: { name: "Emirates Rent A Car", code: "EMR" }, period_start: "2026-09-01", issue_date: "2026-09-30", due_date: "2026-11-15", total: 2400, status: "issued" },
  { id: "i-2", invoice_number: "INV-2026-000042", partner: { name: "Al Futtaim Mobility", code: "AFM" }, period_start: "2026-09-01", issue_date: "2026-09-30", due_date: "2026-10-18", total: 1450, status: "overdue" },
  { id: "i-3", invoice_number: "INV-2026-000036", partner: null, period_start: null, issue_date: "2026-09-30", due_date: "2026-11-14", total: 900, status: "draft" },
];

const table = (isPartner: boolean) =>
  html(createElement(InvoicesTable, { rows: buildInvoiceRows(ROWS, "2026-10-30"), query: query({}, isPartner), showPartner: !isPartner }));

describe("InvoicesTable (VI-F09-S01)", () => {
  it("should show the columns of the design, and the Partner column only to the operations team", () => {
    const internal = table(false);
    const partner = table(true);

    for (const label of ["Invoice number", "Period", "Amount (USD)", "Due date", "Payment status", "Menu"]) {
      expect(internal).toContain(label);
      expect(partner).toContain(label);
    }
    expect(internal).toContain("Partner");
    expect(internal).toContain("Al Futtaim Mobility");
    expect(partner).not.toContain("Al Futtaim Mobility");
  });

  it("should write each row with its amount, due date and payment status", () => {
    const out = table(false);

    expect(out).toContain("USD 2,400.00");
    expect(out).toContain("15 Nov 2026");
    expect(out).toContain("Sep 2026");
    expect(out).toContain('data-status="issued"');
    expect(out).toContain('data-status="draft"');
  });

  it("should say how late an overdue invoice is", () => {
    expect(table(false)).toContain("Overdue by 12 days");
  });

  it("should open the invoice from its number, and offer a menu for each row", () => {
    const out = table(true);

    expect(out).toContain('href="/invoices/i-1"');
    expect(out).toContain("Actions for INV-2026-000045");
  });

  it("should link each column head to the list sorted by it, and offer no Export or Download", () => {
    const out = table(true);

    expect(out).toContain("sort=invoice_number");
    expect(out).toContain("sort=amount");
    expect(out).not.toContain("Export CSV");
    expect(out).not.toContain("Download PDF");
  });
});

describe("InvoicesFilters", () => {
  const partners = [{ value: "p-1", label: "Emirates Rent A Car (EMR)" }];

  it("should offer the Partner filter only to the operations team", () => {
    expect(html(createElement(InvoicesFilters, { query: query({}, false), isPartner: false, partners }))).toContain("Filter by partner");
    expect(html(createElement(InvoicesFilters, { query: query({}, true), isPartner: true, partners: [] }))).not.toContain("Filter by partner");
  });

  it("should keep what was searched in the fields", () => {
    const out = html(createElement(InvoicesFilters, { query: query({ q: "INV-9", from: "2026-01", to: "2026-06" }, true), isPartner: true, partners: [] }));

    expect(out).toContain('value="INV-9"');
    expect(out).toContain("Jan 2026 – Jun 2026");
    expect(out).toContain("Filter by status");
  });

  it("should write the period as From month – To month until one is chosen", () => {
    expect(html(createElement(InvoicesFilters, { query: query({}, true), isPartner: true, partners: [] }))).toContain("From month – To month");
    expect(html(createElement(InvoicesFilters, { query: query({ to: "2026-06" }, true), isPartner: true, partners: [] }))).toContain("From month – Jun 2026");
  });

  it("should turn Clear filters off when nothing is filtered, and on when something is", () => {
    expect(html(createElement(InvoicesFilters, { query: query({}, true), isPartner: true, partners: [] }))).toContain('aria-disabled="true"');
    expect(html(createElement(InvoicesFilters, { query: query({ status: "paid" }, true), isPartner: true, partners: [] }))).toContain('aria-disabled="false"');
  });
});

describe("InvoicesPagination", () => {
  it("should say what the page shows and offer the page size", () => {
    const out = html(createElement(InvoicesPagination, { query: query({ page_size: "10" }, true), total: 9 }));

    expect(out).toContain("Showing 1–9 of 9");
    expect(out).toContain("10 per page");
  });

  it("should turn Previous off on the first page and Next off on the last, and link the others", () => {
    const first = html(createElement(InvoicesPagination, { query: query({ page_size: "10" }, true), total: 25 }));
    const last = html(createElement(InvoicesPagination, { query: query({ page_size: "10", page: "3" }, true), total: 25 }));

    expect(first).toContain("page=2");
    expect(first).toMatch(/aria-disabled="true"[^>]*>Previous/);
    expect(last).toContain("page=2");
    expect(last).toMatch(/aria-disabled="true"[^>]*>Next/);
  });
});

describe("InvoicesEmpty", () => {
  it("should offer to clear the filters when nothing matched", () => {
    const out = html(createElement(InvoicesEmpty, { isFiltered: true }, "Try a different invoice number, status, or period."));

    expect(out).toContain("No invoices match your filters");
    expect(out).toContain("Clear filters");
  });

  it("should say there is nothing yet, with no Clear filters, when there is no invoice", () => {
    const out = html(createElement(InvoicesEmpty, { isFiltered: false }, "Invoices appear here once they are issued to your organization."));

    expect(out).toContain("No invoices yet");
    expect(out).not.toContain("Clear filters");
  });
});

describe("InvoiceDetail", () => {
  it("should show the number, the status and the figures", () => {
    const view = buildInvoiceDetail(
      { id: "i-1", invoice_number: "INV-2026-000018", issue_date: "2026-10-31", due_date: "2026-11-14", subtotal: 5650, vat: 282.5, total: 5932.5, status: "issued", partner: { name: "Emirates Rent A Car", code: "EMR" }, period_start: "2026-10-01" },
      "2026-10-30",
    );
    const out = html(createElement(InvoiceDetail, { view }));

    expect(out).toContain("INV-2026-000018");
    expect(out).toContain('data-status="issued"');
    expect(out).toContain("USD 5,932.50");
  });
});
