import { describe, expect, it } from "vitest";

import { buildInvoiceNotice } from "@/features/invoices/lib/generate-invoice-notice";
import { INTERNAL_ERROR, NETWORK_ERROR, mapInvoiceError } from "@/features/invoices/lib/invoice-errors";
import type { PeriodOption } from "@/features/invoices/lib/invoice-periods";

const OPTION: PeriodOption = {
  month: "2026-09",
  label: "September 2026",
  selectable: true,
  caption: "Approved / selectable",
  invoice_id: null,
  amounts: { subtotal: 5050, vat: 252.5, total: 5302.5 },
};

const notice = (change: Partial<Parameters<typeof buildInvoiceNotice>[0]> = {}) =>
  buildInvoiceNotice({ validation: null, error: null, selected: OPTION, ...change });

describe("buildInvoiceNotice (VI-F09-S06, AC03, AC09, AC10)", () => {
  it("should say that this only makes a draft when nothing went wrong", () => {
    expect(notice()).toMatchObject({ kind: "info", title: "Generate a draft first" });
  });

  it("should show the validation message of the form first", () => {
    expect(notice({ validation: "Select a period with an approved settlement.", selected: null })).toEqual({
      kind: "validation",
      title: "Validation error",
      message: "Select a period with an approved settlement.",
    });
  });

  it("should say the settlement is not approved, and name the month, when the server refuses it (AC09)", () => {
    expect(notice({ error: mapInvoiceError({ code: "IN002" }) })).toMatchObject({
      kind: "not_approved",
      title: "Settlement not approved",
      note: "September 2026 is disabled: No approved settlement.",
    });
  });

  it("should show a month that already has its invoice as a duplicate, with the invoice (AC10)", () => {
    expect(notice({ selected: { ...OPTION, invoice_id: "i-1" } })).toEqual({
      kind: "duplicate",
      title: "Duplicate invoice",
      message: "An invoice for this period already exists",
      invoice_id: "i-1",
    });
  });

  it("should give the invoice the server found when it refuses a duplicate the screen did not know of (AC10)", () => {
    expect(notice({ error: mapInvoiceError({ code: "IN003", details: "i-9" }) })).toMatchObject({
      kind: "duplicate",
      invoice_id: "i-9",
    });
  });

  it.each([
    ["a failure of the server", INTERNAL_ERROR],
    ["a network that is down", NETWORK_ERROR],
  ])("should offer to try again after %s", (_name, error) => {
    expect(notice({ error })).toMatchObject({ kind: "server_error", title: "Server error", message: error.message });
  });

  it("should say what a refusal was, when it is none of the above", () => {
    expect(notice({ error: mapInvoiceError({ code: "42501" }) })).toMatchObject({
      kind: "error",
      message: "You cannot generate an invoice.",
    });
  });
});
