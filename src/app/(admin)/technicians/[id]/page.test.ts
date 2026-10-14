import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getTechnicianByIdMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/technicians/lib/get-technician-by-id", () => ({
  getTechnicianById: getTechnicianByIdMock,
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import TechnicianDetailPage from "@/app/(admin)/technicians/[id]/page";

describe("TechnicianDetailPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getTechnicianByIdMock.mockReset();
    requirePermissionMock.mockResolvedValue({ id: "user-1" });
  });

  it("should guard the page with technicians:manage", async () => {
    getTechnicianByIdMock.mockResolvedValue({
      id: "t-1",
      full_name: "Tech One",
      email: "tech1@example.com",
      is_active: true,
      created_at: "2027-01-01T00:00:00Z",
    });

    await TechnicianDetailPage({ params: Promise.resolve({ id: "t-1" }) });

    expect(requirePermissionMock).toHaveBeenCalledWith("technicians:manage");
  });

  it("should call notFound when the technician does not exist or is not visible", async () => {
    getTechnicianByIdMock.mockResolvedValue(null);

    await expect(
      TechnicianDetailPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
