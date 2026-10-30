import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getInvoiceMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/invoices/lib/get-invoice", () => ({ getInvoice: getInvoiceMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import InvoicePage from "@/app/(dashboard)/invoices/[id]/page";

const ID = "d9100000-0000-0000-0000-000000000001";

const INVOICE = {
  id: ID,
  invoice_number: "INV-2026-000018",
  issue_date: "2026-10-31",
  due_date: "2026-11-14",
  subtotal: 5650,
  vat: 282.5,
  total: 5932.5,
  status: "issued",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-10-01",
};

const render = async (id = ID) => renderToStaticMarkup(await InvoicePage({ params: Promise.resolve({ id }) }));

describe("InvoicePage (VI-F09-S01, NAV-1)", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
    getInvoiceMock.mockReset();
    getInvoiceMock.mockResolvedValue(INVOICE);
    notFoundMock.mockClear();
  });

  it("should check the finance permission before reading anything", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getInvoiceMock).not.toHaveBeenCalled();
  });

  it("should show the invoice with a way back to the list", async () => {
    const html = await render();

    expect(html).toContain("Invoice detail");
    expect(html).toContain("INV-2026-000018");
    expect(html).toContain("USD 5,932.50");
    expect(html).toContain('href="/invoices"');
  });

  it("should read the invoice as a partner user or as an operations user, as the role is", async () => {
    await render();
    requireAnyPermissionMock.mockResolvedValue({ role: "admin" });
    await render();

    expect(getInvoiceMock.mock.calls.map((call) => call[1])).toEqual([true, false]);
  });

  it("should answer not found for an invoice that is unknown, malformed or of another partner, the same for all", async () => {
    getInvoiceMock.mockResolvedValue(null);

    await expect(render("not-an-id")).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("should let a failed read reach the error boundary", async () => {
    getInvoiceMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
