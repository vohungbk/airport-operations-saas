import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getInvoiceMock = vi.hoisted(() => vi.fn());
const getTermsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/invoices/lib/get-invoice", () => ({ getInvoice: getInvoiceMock }));
vi.mock("@/features/invoices/lib/get-payment-terms-days", () => ({ getPaymentTermsDays: getTermsMock }));
vi.mock("@/features/invoices/actions/issue-invoice.action", () => ({ issueInvoiceAction: vi.fn() }));
vi.mock("@/features/invoices/actions/update-invoice-status.action", () => ({ updateInvoiceStatusAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock, useRouter: () => ({ refresh: vi.fn() }) }));

import InvoicePage from "@/app/(dashboard)/invoices/[id]/page";

const ID = "d9100000-0000-0000-0000-000000000001";

const INVOICE = {
  id: ID,
  partner_id: "p-a",
  invoice_number: "INV-2026-000018",
  issue_date: "2026-10-31",
  due_date: "2026-11-14",
  subtotal: 5650,
  vat: 282.5,
  total: 5932.5,
  status: "issued",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-10-01",
  lines: [{ position: 1, description: "Platform share", amount: 5650, counts_toward_subtotal: true }],
};

const render = async (id = ID) => renderToStaticMarkup(await InvoicePage({ params: Promise.resolve({ id }) }));

describe("InvoicePage (VI-F09-S01, NAV-1)", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
    getInvoiceMock.mockReset();
    getInvoiceMock.mockResolvedValue(INVOICE);
    notFoundMock.mockClear();
    getTermsMock.mockReset();
    getTermsMock.mockResolvedValue(30);
  });

  it("should check the finance permission before reading anything", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getInvoiceMock).not.toHaveBeenCalled();
  });

  it("should show the invoice with its lines, its VAT and its payment status", async () => {
    const html = await render();

    expect(html).toContain("INV-2026-000018");
    expect(html).toContain("USD 5,932.50");
    expect(html).toContain("Platform share");
    expect(html).toContain("VAT 5%");
    expect(html).toContain("Current: Issued");
    expect(html).toContain("Download PDF");
  });

  it("should show the partner to the operations team and leave it out for a partner user", async () => {
    requireAnyPermissionMock.mockResolvedValue({ role: "admin" });
    expect(await render()).toContain("Emirates Rent A Car /");

    requireAnyPermissionMock.mockResolvedValue({ role: "partner_user" });
    expect(await render()).not.toContain("Emirates Rent A Car /");
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

  describe("the payment status (VI-F09-S08)", () => {
    it.each([["issued"], ["overdue"]])("should offer Update status to an admin looking at an invoice that is %s (AC01)", async (status) => {
      requireAnyPermissionMock.mockResolvedValue({ role: "admin" });
      getInvoiceMock.mockResolvedValue({ ...INVOICE, status });

      expect(await render()).toContain("Update status");
    });

    it.each([["paid"], ["void"], ["draft"]])("should not offer Update status for an invoice that is %s, which has no move", async (status) => {
      requireAnyPermissionMock.mockResolvedValue({ role: "admin" });
      getInvoiceMock.mockResolvedValue({ ...INVOICE, status });

      expect(await render()).not.toContain("Update status");
    });

    it.each([["operations_manager"], ["partner_user"]])("should not offer Update status to %s", async (role) => {
      requireAnyPermissionMock.mockResolvedValue({ role });

      expect(await render()).not.toContain("Update status");
    });
  });

  describe("a draft (VI-F09-S07)", () => {
    const DRAFT = { ...INVOICE, status: "draft" };

    beforeEach(() => getInvoiceMock.mockResolvedValue(DRAFT));

    it("should offer Issue invoice to an admin, with the payment terms of the partner (AC01, AC02)", async () => {
      requireAnyPermissionMock.mockResolvedValue({ role: "admin" });

      const html = await render();

      expect(getTermsMock).toHaveBeenCalledWith("p-a");
      expect(html).toContain("Issue invoice");
      expect(html).toContain("Not issued / Due date on issue");
      expect(html).toContain("Payment terms: 30 days");
    });

    it("should show an operations manager the draft without Issue invoice", async () => {
      requireAnyPermissionMock.mockResolvedValue({ role: "operations_manager" });

      const html = await render();

      expect(html).not.toContain("Issue invoice");
      expect(html).toContain("Payment terms: 30 days");
    });

    it("should not read the payment terms, or offer Issue invoice, for a partner user", async () => {
      const html = await render();

      expect(getTermsMock).not.toHaveBeenCalled();
      expect(html).not.toContain("Issue invoice");
    });

    it("should not offer Issue invoice for an invoice that is already issued, and not read the terms", async () => {
      requireAnyPermissionMock.mockResolvedValue({ role: "admin" });
      getInvoiceMock.mockResolvedValue(INVOICE);

      const html = await render();

      expect(getTermsMock).not.toHaveBeenCalled();
      expect(html).not.toContain("Issue invoice");
    });
  });
});
