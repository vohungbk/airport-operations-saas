import { describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

import PartnerPage from "@/app/(partner)/partner/page";

function makeUser(partner_id: string | null) {
  return {
    id: "user-1",
    email: "partner@example.com",
    full_name: "Partner User",
    role: "partner_user" as const,
    partner_id,
    is_active: true,
  };
}

describe("PartnerPage", () => {
  it("should guard the page with bookings:view_own_partner (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(makeUser("partner-abc"));

    await PartnerPage();

    expect(requirePermissionMock).toHaveBeenCalledWith(
      "bookings:view_own_partner",
    );
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(PartnerPage()).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("should render the safe empty state (not an error, not another partner's data) when partner_id is null", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(makeUser(null));

    const element = await PartnerPage();
    const children = element.props.children as unknown[];
    const rendered = JSON.stringify(children);

    expect(rendered).toContain("No partner is assigned");
  });

  it("should render only the authenticated user's own partner_id, never a different one", async () => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(makeUser("partner-own"));

    const element = await PartnerPage();
    const rendered = JSON.stringify(element.props.children);

    expect(rendered).toContain("partner-own");
  });
});
