import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getBookingByIdMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/bookings/lib/get-booking-by-id", () => ({
  getBookingById: getBookingByIdMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

import EditBookingPage from "@/app/(dashboard)/bookings/[id]/edit/page";

const ID = "f0000000-0000-4000-8000-000000000001";

describe("EditBookingPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    getBookingByIdMock.mockReset();
  });

  it("should require bookings:manage so partner users cannot edit", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, status: "pending", airport: { timezone: "Asia/Dubai" } });

    await EditBookingPage({ params: Promise.resolve({ id: ID }) });

    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:manage");
  });

  it("should redirect a terminal booking back to its detail page", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, status: "cancelled", airport: { timezone: "Asia/Dubai" } });

    await expect(
      EditBookingPage({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow(`REDIRECT:/bookings/${ID}`);
  });

  it("should call notFound when the booking airport is hidden or missing", async () => {
    getBookingByIdMock.mockResolvedValue({ id: ID, status: "pending", airport: null });

    await expect(
      EditBookingPage({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("should call notFound for an unknown booking", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    await expect(
      EditBookingPage({ params: Promise.resolve({ id: ID }) }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
