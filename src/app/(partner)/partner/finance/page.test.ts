import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePartnerScopeMock = vi.hoisted(() => vi.fn());
const getFinanceMock = vi.hoisted(() => vi.fn());
const getSummaryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePartnerScope: requirePartnerScopeMock,
}));

vi.mock("@/features/partners/lib/get-partner-finance", () => ({
  getPartnerFinance: getFinanceMock,
}));

vi.mock("@/features/partners/lib/get-partner-summary", () => ({
  getPartnerSummary: getSummaryMock,
}));

import PartnerFinancePage from "@/app/(partner)/partner/finance/page";

const USER = {
  id: "user-1",
  email: "partner@example.com",
  full_name: "Partner User",
  role: "partner_user" as const,
  partner_id: "partner-a",
  is_active: true,
};

const FINANCE = {
  settlement: { period_start: "2026-10-01", gross_revenue: 12000, partner_share: 6000, final_amount: 5670 },
  invoices: [
    { id: "i-1", invoice_number: "INV-2026-0010", issue_date: "2026-10-31", total: 5953.5, status: "issued" as const, period_start: "2026-10-01" },
  ],
  terms: null,
};

const render = async () => renderToStaticMarkup(await PartnerFinancePage());

describe("PartnerFinancePage", () => {
  beforeEach(() => {
    requirePartnerScopeMock.mockReset();
    requirePartnerScopeMock.mockResolvedValue(USER);
    getFinanceMock.mockReset();
    getFinanceMock.mockResolvedValue(FINANCE);
    getSummaryMock.mockReset();
    getSummaryMock.mockResolvedValue({ name: "Emirates Rent A Car", code: "EMR" });
  });

  it("should guard the page with finance:view_own_partner", async () => {
    await render();

    expect(requirePartnerScopeMock).toHaveBeenCalledWith("finance:view_own_partner");
  });

  it("should propagate the guard's refusal without reading any finance figure (permission denied)", async () => {
    requirePartnerScopeMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getFinanceMock).not.toHaveBeenCalled();
    expect(getSummaryMock).not.toHaveBeenCalled();
  });

  it("should read the summary of the partner of the signed-in user, and ask for no partner in the finance read", async () => {
    await render();

    expect(getSummaryMock).toHaveBeenCalledWith("partner-a");
    expect(getFinanceMock).toHaveBeenCalledWith();
  });

  it("should show the heading, the partner name and the figures of the partner (success)", async () => {
    const html = await render();

    expect(html).toContain("Partner Finance");
    expect(html).toContain("Emirates Rent A Car only · Read-only finance workspace");
    expect(html).toContain("$12,000");
    expect(html).toContain("INV-2026-0010");
  });

  it("should say there are no finance records yet, not an error, when there is nothing (empty)", async () => {
    getFinanceMock.mockResolvedValue({ settlement: null, invoices: [], terms: null });

    const html = await render();

    expect(html).toContain("No finance records yet");
    expect(html).not.toContain("Invoices and statements");
  });

  it("should let a failed read reach the error boundary instead of showing an empty screen (error)", async () => {
    getFinanceMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });

  it("should say the partner could not be found when its summary cannot be read", async () => {
    getSummaryMock.mockResolvedValue(null);

    const html = await render();

    expect(html).toContain("Your partner could not be found");
    expect(html).not.toContain("$12,000");
  });
});
