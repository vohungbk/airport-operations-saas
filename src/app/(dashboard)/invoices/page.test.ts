import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getInvoicesMock = vi.hoisted(() => vi.fn());
const getPartnersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/invoices/lib/get-invoices", () => ({ getInvoices: getInvoicesMock }));
vi.mock("@/features/settlements/lib/get-settlement-partners", () => ({ getSettlementPartners: getPartnersMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import InvoicesPage from "@/app/(dashboard)/invoices/page";

const user = (role: string) => ({ id: "u-1", email: "u@example.com", full_name: "U", role, partner_id: role === "partner_user" ? "p-a" : null, is_active: true });

const INVOICE = {
  id: "i-1",
  invoice_number: "INV-2026-000045",
  partner: { name: "Emirates Rent A Car", code: "EMR" },
  period_start: "2026-09-01",
  issue_date: "2026-09-30",
  due_date: "2026-11-15",
  total: 2400,
  status: "issued",
};

async function render(raw: Record<string, string> = {}) {
  return renderToStaticMarkup(await InvoicesPage({ searchParams: Promise.resolve(raw) }));
}

describe("InvoicesPage (VI-F09-S01)", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue(user("partner_user"));
    getInvoicesMock.mockReset();
    getInvoicesMock.mockResolvedValue({ invoices: [INVOICE], total: 1, page: 1 });
    getPartnersMock.mockReset();
    getPartnersMock.mockResolvedValue([{ value: "p-1", label: "Emirates Rent A Car (EMR)" }]);
  });

  it("should check the finance permission before reading anything", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["finance:view", "finance:view_own_partner"]);
  });

  it("should propagate the refusal without reading any invoice (permission denied)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getInvoicesMock).not.toHaveBeenCalled();
    expect(getPartnersMock).not.toHaveBeenCalled();
  });

  it("should show a partner user the list of its own account, with no Partner filter or column", async () => {
    const html = await render();

    expect(html).toContain("Invoices for your account");
    expect(html).toContain("INV-2026-000045");
    expect(html).toContain('href="/invoices/i-1"');
    expect(html).not.toContain("Filter by partner");
    expect(getPartnersMock).not.toHaveBeenCalled();
    expect(getInvoicesMock.mock.calls[0][1]).toBe(true);
  });

  it("should show an operations user the invoices of all partners, with the Partner filter", async () => {
    requireAnyPermissionMock.mockResolvedValue(user("operations_manager"));

    const html = await render();

    expect(html).toContain("Invoices for all partners");
    expect(html).toContain("Filter by partner");
    expect(html).toContain("Emirates Rent A Car");
    expect(getInvoicesMock.mock.calls[0][1]).toBe(false);
  });

  it("should drop a partner put in the address by a partner user, and keep it for an operations user", async () => {
    await render({ partner_id: "b0000000-0000-0000-0000-000000000002" });
    expect(getInvoicesMock.mock.calls[0][0]).not.toHaveProperty("partner_id");

    requireAnyPermissionMock.mockResolvedValue(user("admin"));
    await render({ partner_id: "b0000000-0000-0000-0000-000000000002" });
    expect(getInvoicesMock.mock.calls[1][0].partner_id).toBe("b0000000-0000-0000-0000-000000000002");
  });

  it("should say there are no invoices yet, not an error, when there is none", async () => {
    getInvoicesMock.mockResolvedValue({ invoices: [], total: 0, page: 1 });

    const html = await render();

    expect(html).toContain("No invoices yet");
    expect(html).not.toContain("No invoices match your filters");
  });

  it("should say nothing matched, and offer Clear filters, when a filter is on", async () => {
    getInvoicesMock.mockResolvedValue({ invoices: [], total: 0, page: 1 });

    const html = await render({ q: "INV-2026-999999", status: "paid" });

    expect(html).toContain("No invoices match your filters");
    expect(html).toContain("Clear filters");
  });

  it("should let a failed read reach the error boundary instead of showing an empty list (error)", async () => {
    getInvoicesMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });

  it("should serve the last page when the page asked for is past the end", async () => {
    getInvoicesMock.mockResolvedValue({ invoices: [INVOICE], total: 12, page: 2 });

    expect(await render({ page: "9", page_size: "10" })).toContain("Showing 11–12 of 12");
  });

  it("should offer Export CSV with the filters and the sort of the list, and no page, in every state", async () => {
    const html = await render({ q: "INV-9", status: "paid", from: "2026-01", sort: "amount", order: "asc", page: "3", page_size: "25" });

    expect(html).toContain("Export CSV");
    expect(html).toContain('href="/api/invoices/export?');
    expect(html).toContain("q=INV-9");
    expect(html).toContain("status=paid");
    expect(html).toContain("sort=amount");
    expect(html).not.toMatch(/api\/invoices\/export\?[^"]*page/);

    getInvoicesMock.mockResolvedValue({ invoices: [], total: 0, page: 1 });
    expect(await render()).toContain("Export CSV");
  });

  it("should leave a partner the user is not allowed to filter by out of its export address", async () => {
    const html = await render({ partner_id: "b0000000-0000-0000-0000-000000000002" });

    expect(html).not.toContain("partner_id=");
  });
});
