import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getPartnerByIdMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/partners/lib/get-partner-by-id", () => ({
  getPartnerById: getPartnerByIdMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

import EditPartnerPage from "@/app/(admin)/partners/[id]/edit/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const PARTNER = {
  id: "partner-1",
  name: "Emirates Rent A Car",
  code: "ERAC",
  contact_email: "ops@erac.example.com",
  status: "active" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("EditPartnerPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getPartnerByIdMock.mockReset();
    notFoundMock.mockClear();
  });

  it("should guard the page with partners:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getPartnerByIdMock.mockResolvedValue(PARTNER);

    await EditPartnerPage({ params: Promise.resolve({ id: "partner-1" }) });

    expect(requirePermissionMock).toHaveBeenCalledWith("partners:manage");
    expect(getPartnerByIdMock).toHaveBeenCalledWith("partner-1");
  });

  it("should call notFound() when the partner does not exist", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getPartnerByIdMock.mockResolvedValue(null);

    await expect(
      EditPartnerPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      EditPartnerPage({ params: Promise.resolve({ id: "partner-1" }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getPartnerByIdMock).not.toHaveBeenCalled();
  });
});
