import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getInvoiceHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/invoices/lib/get-invoice-history", () => ({ getInvoiceHistory: getInvoiceHistoryMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import InvoiceHistoryPage from "@/app/(dashboard)/invoices/history/page";

const user = (role: string) => ({ id: "u-1", email: "u@example.com", full_name: "U", role, partner_id: role === "partner_user" ? "p-a" : null, is_active: true });

const INVOICE_ID = "d5600000-0000-0000-0000-000000000001";
const ROWS = [
  {
    id: "h-1",
    invoice_id: INVOICE_ID,
    invoice_number: "INV-2026-000031",
    from_status: "draft",
    to_status: "issued",
    reason: "Invoice status moved from draft to issued",
    actor_name: "Aisha Khan",
    changed_at: "2026-09-01T06:00:00Z",
  },
  {
    id: "h-2",
    invoice_id: INVOICE_ID,
    invoice_number: "INV-2026-000031",
    from_status: "issued",
    to_status: "overdue",
    reason: "Invoice passed its due date",
    actor_name: null,
    changed_at: "2026-10-13T20:05:00Z",
  },
];
const HISTORY = {
  rows: ROWS,
  invoices: [
    { id: INVOICE_ID, invoice_number: "INV-2026-000031" },
    { id: "i-2", invoice_number: "INV-2026-000045" },
  ],
  years: [2026, 2025],
};

async function render(raw: Record<string, string> = {}) {
  return renderToStaticMarkup(await InvoiceHistoryPage({ searchParams: Promise.resolve(raw) }));
}

describe("InvoiceHistoryPage (VI-F09-S10)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue(user("partner_user"));
    getInvoiceHistoryMock.mockReset();
    getInvoiceHistoryMock.mockResolvedValue(HISTORY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should check the finance permission before reading anything (AC01)", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(["finance:view", "finance:view_own_partner"]);
  });

  it("should propagate the refusal without reading any history (permission denied)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getInvoiceHistoryMock).not.toHaveBeenCalled();
  });

  it("should list each event with what happened, the time in GST, the actor and the reason (AC02)", async () => {
    const html = await render();

    expect(html).toContain("Invoice history");
    expect(html).toContain("Issued / 000031");
    expect(html).toContain("01 Sep 2026, 10:00 GST");
    expect(html).toContain("Aisha Khan");
    expect(html).toContain("Marked overdue / 000031");
    expect(html).toContain("System");
    expect(html).toContain("Invoice passed its due date");
  });

  it("should show the two fields of the design with their hints", async () => {
    const html = await render();

    expect(html).toContain("Invoice number");
    expect(html).toContain("All invoices");
    expect(html).toContain("Search INV-2026-000031 through INV-2026-000045");
    expect(html).toContain("Period");
    expect(html).toContain("Read-only audit history / GST (UTC+4)");
  });

  it("should say there is no history, not an error, when there is none", async () => {
    getInvoiceHistoryMock.mockResolvedValue({ rows: [], invoices: [], years: [2026] });

    const html = await render();

    expect(html).toContain("No invoice history for this selection.");
    expect(html).not.toContain("Could not load");
  });

  it("should not hide a failed read as an empty history", async () => {
    getInvoiceHistoryMock.mockRejectedValue(new Error("connection refused"));

    await expect(render()).rejects.toThrow("connection refused");
  });

  it("should read as a partner user for a partner user and as an operations user for the others", async () => {
    await render();
    requireAnyPermissionMock.mockResolvedValue(user("admin"));
    await render();

    expect(getInvoiceHistoryMock.mock.calls[0][1]).toBe(true);
    expect(getInvoiceHistoryMock.mock.calls[1][1]).toBe(false);
  });

  it("should start on this year in Dubai when no year is given", async () => {
    await render();

    expect(getInvoiceHistoryMock.mock.calls[0][0].year).toBe(2026);
    expect(getInvoiceHistoryMock.mock.calls[0][2]).toBe(2026);
  });

  it("should read the invoice and the year of the address", async () => {
    await render({ invoice_id: INVOICE_ID, year: "2025" });

    expect(getInvoiceHistoryMock.mock.calls[0][0]).toEqual({ invoice_id: INVOICE_ID, year: 2025 });
  });

  it("should ignore a garbled invoice and year instead of failing", async () => {
    const html = await render({ invoice_id: "not-an-id", year: "abc" });

    expect(getInvoiceHistoryMock.mock.calls[0][0]).toEqual({ year: 2026 });
    expect(html).toContain("Invoice history");
  });
});
