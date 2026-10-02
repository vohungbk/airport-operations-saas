import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatsMock = vi.hoisted(() => vi.fn());
const getSeatFormOptionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/seats/lib/get-seats", () => ({
  getSeats: getSeatsMock,
}));

vi.mock("@/features/seats/lib/get-seat-form-options", () => ({
  getSeatFormOptions: getSeatFormOptionsMock,
}));

import SeatsPage from "@/app/(admin)/seats/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("SeatsPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getSeatsMock.mockReset();
    getSeatsMock.mockResolvedValue({ seats: [], total: 0, page: 1 });
    getSeatFormOptionsMock.mockReset();
    getSeatFormOptionsMock.mockResolvedValue({ airports: [], categories: [] });
  });

  it("should guard the page with seats:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await SeatsPage({ searchParams: Promise.resolve({}) });

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
  });

  it("should pass the combined airport, category and status filters from the URL to getSeats", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await SeatsPage({
      searchParams: Promise.resolve({
        airport_id: "a0000000-0000-0000-0000-000000000001",
        category_id: "c0000000-0000-0000-0000-000000000002",
        status: "quarantine",
      }),
    });

    expect(getSeatsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        airport_id: "a0000000-0000-0000-0000-000000000001",
        category_id: "c0000000-0000-0000-0000-000000000002",
        status: "quarantine",
      }),
    );
  });

  it("should ignore an invalid status in the URL instead of failing the render", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await SeatsPage({ searchParams: Promise.resolve({ status: "bogus" }) });

    expect(getSeatsMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined }),
    );
  });

  it("should propagate the guard's redirect and not load seats", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      SeatsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSeatsMock).not.toHaveBeenCalled();
  });
});
