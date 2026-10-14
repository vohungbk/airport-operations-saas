import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getTechniciansMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/technicians/lib/get-technicians", () => ({
  getTechnicians: getTechniciansMock,
}));

import TechniciansPage from "@/app/(admin)/technicians/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

describe("TechniciansPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getTechniciansMock.mockReset();
    getTechniciansMock.mockResolvedValue({ technicians: [], total: 0 });
  });

  it("should guard the page with technicians:manage", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await TechniciansPage({ searchParams: Promise.resolve({}) });

    expect(requirePermissionMock).toHaveBeenCalledWith("technicians:manage");
  });

  it("should propagate the guard's redirect without loading data", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      TechniciansPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getTechniciansMock).not.toHaveBeenCalled();
  });

  it("should not apply an over-long search to the query", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await TechniciansPage({
      searchParams: Promise.resolve({ q: "a".repeat(101) }),
    });

    expect(getTechniciansMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined }),
    );
  });

  it("should pass a valid search to the query", async () => {
    requirePermissionMock.mockResolvedValue(USER);

    await TechniciansPage({ searchParams: Promise.resolve({ q: "ali" }) });

    expect(getTechniciansMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: "ali" }),
    );
  });
});
