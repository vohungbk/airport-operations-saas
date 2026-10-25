import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getSettlementsMock = vi.hoisted(() => vi.fn());
const getPartnersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/settlements/lib/get-settlements", () => ({ getSettlements: getSettlementsMock }));
vi.mock("@/features/settlements/lib/get-settlement-partners", () => ({
  getSettlementPartners: getPartnersMock,
}));
vi.mock("@/features/settlements/actions/move-settlement-status.action", () => ({
  moveSettlementStatusAction: vi.fn(),
}));
vi.mock("@/features/settlements/components/generate-settlement-form", () => ({
  GenerateSettlementForm: () => createElement("form", { "data-testid": "generate-form" }),
}));

import SettlementsPage from "@/app/(dashboard)/settlements/page";
import { FINANCE_ACCESS_PERMISSIONS } from "@/lib/auth/permissions";

const render = async () => {
  const element = (await SettlementsPage()) as ReactElement;
  expect(isValidElement(element as ReactNode)).toBe(true);
  return renderToStaticMarkup(element);
};

describe("SettlementsPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getSettlementsMock.mockReset();
    getSettlementsMock.mockResolvedValue([]);
    getPartnersMock.mockReset();
    getPartnersMock.mockResolvedValue([{ value: "p-1", label: "Demo (DEMO)" }]);
  });

  it("should check the permission before anything is read (AC02)", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(SettlementsPage()).rejects.toThrow("REDIRECT:/forbidden");
    expect(requireAnyPermissionMock).toHaveBeenCalledWith(FINANCE_ACCESS_PERMISSIONS);
    expect(getSettlementsMock).not.toHaveBeenCalled();
    expect(getPartnersMock).not.toHaveBeenCalled();
  });

  it("should list the settlements and show the form to an admin (AC02, AC03)", async () => {
    const html = await render();

    expect(html).toContain("No settlements yet.");
    expect(html).toContain('data-testid="generate-form"');
    expect(getPartnersMock).toHaveBeenCalled();
  });

  it("should show the table when there are settlements (AC03)", async () => {
    getSettlementsMock.mockResolvedValue([
      {
        id: "s-1", period_start: "2026-09-01", gross_revenue: 740, partner_share: 222, platform_share: 518,
        refunds: 100, adjustments: 10, chargebacks: 50, launch_credit: 0, fees: 0, final_amount: 222,
        status: "draft", status_changed_at: "2026-10-25T09:00:00Z", partner: { name: "Demo Car Rental", code: "DEMO" },
      },
    ]);

    const html = await render();

    expect(html).not.toContain("No settlements yet.");
    expect(html).toContain("Demo Car Rental (DEMO)");
    expect(html).toContain("Send for approval");
  });

  it("should not give the buttons that move a status to an operations manager or a partner user", async () => {
    getSettlementsMock.mockResolvedValue([
      {
        id: "s-1", period_start: "2026-09-01", gross_revenue: 740, partner_share: 222, platform_share: 518,
        refunds: 0, adjustments: 0, chargebacks: 0, launch_credit: 0, fees: 0, final_amount: 222,
        status: "draft", status_changed_at: "2026-10-25T09:00:00Z", partner: { name: "Demo", code: "DEMO" },
      },
    ]);

    for (const role of ["operations_manager", "partner_user"]) {
      requireAnyPermissionMock.mockResolvedValue({ id: "u-2", role });
      expect(await render()).not.toContain("Send for approval");
    }
  });

  it.each(["operations_manager", "partner_user"])(
    "should show the list but no form to %s, and not read the partners",
    async (role) => {
      requireAnyPermissionMock.mockResolvedValue({ id: "u-2", role });

      const html = await render();

      expect(html).not.toContain('data-testid="generate-form"');
      expect(getPartnersMock).not.toHaveBeenCalled();
      expect(getSettlementsMock).toHaveBeenCalled();
    },
  );

  it("should write nothing itself: no action is imported", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/(dashboard)/settlements/page.tsx", "utf8"),
    );

    expect(source).not.toContain("rpc(");
    expect(source).not.toContain(".insert(");
  });
});
