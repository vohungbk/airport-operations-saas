import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatFormOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/seats/lib/get-seat-form-options", () => ({
  getSeatFormOptions: getSeatFormOptionsMock,
}));

import NewSeatPage from "@/app/(admin)/seats/new/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("NewSeatPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getSeatFormOptionsMock.mockReset();
    getSeatFormOptionsMock.mockResolvedValue({ airports: [], categories: [] });
  });

  it("should guard the page with seats:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await NewSeatPage();

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
  });

  it("should propagate the guard's redirect and not load form options", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(NewSeatPage()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSeatFormOptionsMock).not.toHaveBeenCalled();
  });
});
