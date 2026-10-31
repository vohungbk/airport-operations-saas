import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/invoices/actions/generate-invoice.action", () => ({ generateInvoiceAction: vi.fn() }));

import { GenerateInvoiceCreated } from "@/features/invoices/components/generate-invoice-created";
import { GenerateInvoiceForm } from "@/features/invoices/components/generate-invoice-form";
import { InvoicePeriodsList } from "@/features/invoices/components/invoice-periods-list";
import { buildPeriodOptions } from "@/features/invoices/lib/invoice-periods";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const PERIODS = [
  { partner_id: "p-a", period_start: "2026-09-01", status: "approved", platform_share: 5050, fees: 0, invoice_id: null },
  { partner_id: "p-a", period_start: "2026-10-01", status: "draft", platform_share: 100, fees: 0, invoice_id: null },
];

describe("GenerateInvoiceForm (VI-F09-S06, AC01, AC02)", () => {
  const render = () =>
    html(createElement(GenerateInvoiceForm, { partners: [{ value: "p-a", label: "Emirates Rent A Car (EMR)" }], periods: PERIODS }));

  it("should show the fields, the box that says this only makes a draft, and Generate draft and Cancel", () => {
    const out = render();

    for (const text of ["Generate invoice", "Partner", "Period", "Only months with an approved settlement are selectable."]) {
      expect(out).toContain(text);
    }
    expect(out).toContain("Generate a draft first");
    expect(out).toContain("No invoice is issued until you confirm the issue step.");
    expect(out).toContain("Generate draft");
  });

  it("should send Cancel back to the invoice list (AC08)", () => {
    expect(render()).toMatch(/<a[^>]*href="\/invoices"[^>]*>Cancel<\/a>/);
  });

  it("should not offer to issue the invoice: this story makes a draft only", () => {
    expect(render()).not.toContain("Issue invoice");
  });

  it("should show no month, and no amount, before a partner is chosen", () => {
    const out = render();

    expect(out).not.toContain("Available settlement periods");
    expect(out).not.toContain("Settlement amount / read only");
  });
});

describe("InvoicePeriodsList (VI-F09-S06, AC03)", () => {
  const render = (month = "") =>
    html(
      createElement(InvoicePeriodsList, {
        options: buildPeriodOptions(PERIODS, "p-a"),
        month,
        disabled: false,
        onSelect: () => undefined,
      }),
    );

  it("should list each month with whether it can be chosen", () => {
    const out = render();

    expect(out).toContain("Available settlement periods");
    expect(out).toContain("September 2026");
    expect(out).toContain("Approved / selectable");
    expect(out).toContain("October 2026");
    expect(out).toContain("No approved settlement / disabled");
  });

  it("should disable the month of a settlement that is not approved, and mark the month chosen", () => {
    const out = render("2026-09");

    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>October 2026<\/button>/);
    expect(out).toMatch(/<button[^>]*aria-pressed="true"[^>]*>September 2026<\/button>/);
  });
});

describe("GenerateInvoiceCreated (VI-F09-S06, AC04, AC07)", () => {
  const out = html(
    createElement(GenerateInvoiceCreated, {
      invoice: { id: "i-44", invoice_number: "INV-2026-000044", total: 5302.5 },
      subject: "Emirates Rent A Car / September 2026",
    }),
  );

  it("should say which draft was made and for whom, with its total", () => {
    expect(out).toContain("Draft generated");
    expect(out).toContain("New unique draft INV-2026-000044 was created for Emirates Rent A Car / September 2026.");
    expect(out).toContain("USD 5,302.50");
    expect(out).toContain('data-status="draft"');
  });

  it("should open the new draft's detail, and let the user go back to the list (AC07, AC08)", () => {
    expect(out).toMatch(/<a[^>]*href="\/invoices\/i-44"[^>]*>View new draft<\/a>/);
    expect(out).toMatch(/<a[^>]*href="\/invoices"[^>]*>Cancel<\/a>/);
  });
});
