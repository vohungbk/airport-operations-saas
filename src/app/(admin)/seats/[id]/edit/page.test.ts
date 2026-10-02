import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatByIdMock = vi.hoisted(() => vi.fn());
const getSeatFormOptionsMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/seats/lib/get-seat-by-id", () => ({
  getSeatById: getSeatByIdMock,
}));

vi.mock("@/features/seats/lib/get-seat-form-options", () => ({
  getSeatFormOptions: getSeatFormOptionsMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import EditSeatPage from "@/app/(admin)/seats/[id]/edit/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const SEAT = {
  id: "seat-1",
  status: "available",
  category_id: "category-1",
};

describe("EditSeatPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    getSeatByIdMock.mockReset();
    getSeatFormOptionsMock.mockReset();
    getSeatFormOptionsMock.mockResolvedValue({ airports: [], categories: [] });
    notFoundMock.mockClear();
    redirectMock.mockClear();
  });

  it("should guard the page with seats:manage (defense-in-depth alongside the layout)", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getSeatByIdMock.mockResolvedValue(SEAT);

    await EditSeatPage({ params: Promise.resolve({ id: "seat-1" }) });

    expect(requirePermissionMock).toHaveBeenCalledWith("seats:manage");
    expect(getSeatByIdMock).toHaveBeenCalledWith("seat-1");
    expect(getSeatFormOptionsMock).toHaveBeenCalledWith("category-1");
  });

  it("should call notFound() when the seat does not exist or is hidden", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getSeatByIdMock.mockResolvedValue(null);

    await expect(
      EditSeatPage({ params: Promise.resolve({ id: "missing-id" }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("should redirect a retired seat back to its detail page (view-only)", async () => {
    requirePermissionMock.mockResolvedValue(USER);
    getSeatByIdMock.mockResolvedValue({ ...SEAT, status: "retired" });

    await expect(
      EditSeatPage({ params: Promise.resolve({ id: "seat-1" }) }),
    ).rejects.toThrow("REDIRECT:/seats/seat-1");
    expect(getSeatFormOptionsMock).not.toHaveBeenCalled();
  });

  it("should propagate the guard's redirect and not query the seat", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(
      EditSeatPage({ params: Promise.resolve({ id: "seat-1" }) }),
    ).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSeatByIdMock).not.toHaveBeenCalled();
  });
});
