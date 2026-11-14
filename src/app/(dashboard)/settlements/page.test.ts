import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getSettlementsMock = vi.hoisted(() => vi.fn());
const getPartnersMock = vi.hoisted(() => vi.fn());
const getAirportMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/settlements/lib/get-settlements", () => ({ getSettlements: getSettlementsMock }));
vi.mock("@/features/settlements/lib/get-settlement-partners", () => ({
  getSettlementPartners: getPartnersMock,
}));
vi.mock("@/features/flights/lib/simulator-lookup", () => ({ getDefaultSimulatorAirport: getAirportMock }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: refreshMock }) }));
vi.mock("@/features/settlements/actions/move-settlement-status.action", () => ({
  moveSettlementStatusAction: vi.fn(),
}));
vi.mock("@/features/settlements/components/generate-settlement-dialog", () => ({
  GenerateSettlementDialog: () => createElement("button", { "data-testid": "generate-button" }, "Generate settlement"),
}));

import SettlementsPage from "@/app/(dashboard)/settlements/page";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

const render = async (params: Record<string, string> = {}) => {
  const element = (await SettlementsPage({ searchParams: Promise.resolve(params) })) as ReactElement;
  expect(isValidElement(element as ReactNode)).toBe(true);
  return renderToStaticMarkup(element);
};

describe("SettlementsPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getSettlementsMock.mockReset();
    getSettlementsMock.mockResolvedValue({ settlements: [], total: 0, page: 1 });
    getAirportMock.mockReset();
    getAirportMock.mockResolvedValue({ code: "DXB", name: "Dubai International", timezone: "Asia/Dubai" });
    getPartnersMock.mockReset();
    getPartnersMock.mockResolvedValue([{ value: "p-1", label: "Demo (DEMO)" }]);
  });

  it("should check the permission before anything is read (AC02)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(SettlementsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(FINANCE_ACCESS_PERMISSIONS);
    expect(getSettlementsMock).not.toHaveBeenCalled();
    expect(getPartnersMock).not.toHaveBeenCalled();
  });

  it("should list the settlements and show the form to an admin (AC02, AC03)", async () => {
    const html = await render();

    expect(html).toContain("No settlements yet.");
    expect(html).toContain('data-testid="generate-button"');
    expect(getPartnersMock).toHaveBeenCalled();
  });

  const sample = {
    id: "s-1", settlement_number: "SET-2026-0010", period_start: "2026-10-01", gross_revenue: 11865,
    partner_share: 5932.5, platform_share: 5932.5, refunds: 0, adjustments: 0, chargebacks: 0,
    launch_credit: 0, fees: 0, final_amount: 5932.5, status: "pending_approval",
    status_changed_at: "2026-10-25T09:00:00Z", partner: { name: "Emirates Rent A Car", code: "ERC" },
  };

  it("should show the heading, the airport line and the register when there are settlements (AC03)", async () => {
    getSettlementsMock.mockResolvedValue({ settlements: [sample], total: 1, page: 1 });

    const html = await render();

    expect(html).not.toContain("No settlements yet.");
    expect(html).toContain(">Settlements<");
    expect(html).toContain("DXB · ");
    expect(html).toContain("Asia/Dubai (GST, UTC+4)");
    expect(html).toContain("Settlement register");
    expect(html).toContain("SET-2026-0010");
    expect(html).toContain("Emirates Rent A Car");
    expect(html).not.toContain("Approve");
  });

  it("should say nothing matches when the filters leave no settlement", async () => {
    const html = await render({ status: "paid" });

    expect(getSettlementsMock).toHaveBeenCalledWith(expect.objectContaining({ status: "paid", page: 1 }));
    expect(html).toContain("No settlements match the filters.");
  });

  it("should serve a page past the last one as the last page", async () => {
    getSettlementsMock.mockResolvedValue({ settlements: [sample], total: 11, page: 2 });

    const html = await render({ page: "9" });

    expect(html).toContain("Showing 11–11 of 11 settlements");
  });

  it("should give the Generate button to an admin only, and no buttons that move a status to anyone", async () => {
    getSettlementsMock.mockResolvedValue({ settlements: [sample], total: 1, page: 1 });

    for (const role of ["operations_manager", "partner_user"]) {
      requireAnyPermissionMock.mockResolvedValue({ id: "u-2", role });
      const html = await render();

      expect(html).not.toContain("Approve");
      expect(html).not.toContain('data-testid="generate-button"');
    }

    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    const adminHtml = await render();

    expect(adminHtml).toContain('data-testid="generate-button"');
    expect(adminHtml).not.toContain("Approve");
  });

  it("should read the partners for the filter of an operations manager but not for a partner user", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "u-2", role: "operations_manager" });
    await render();
    expect(getPartnersMock).toHaveBeenCalledTimes(1);

    getPartnersMock.mockClear();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-3", role: "partner_user" });
    await render({ partner_id: "9b2f6f0e-6f5e-4c9e-8a53-0a3f6b1c2d3e" });

    expect(getPartnersMock).not.toHaveBeenCalled();
    expect(getSettlementsMock).toHaveBeenLastCalledWith(expect.not.objectContaining({ partner_id: expect.anything() }));
  });

  it("should write nothing itself: no action is imported", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/(dashboard)/settlements/page.tsx", "utf8"),
    );

    expect(source).not.toContain("rpc(");
    expect(source).not.toContain(".insert(");
  });
});
