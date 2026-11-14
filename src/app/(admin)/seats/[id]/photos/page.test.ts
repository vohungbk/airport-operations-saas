import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSeatByIdMock = vi.hoisted(() => vi.fn());
const getSeatPhotosMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);

vi.mock("@/lib/auth/current-user", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/features/seats/lib/get-seat-by-id", () => ({ getSeatById: getSeatByIdMock }));
vi.mock("@/features/bookings/lib/get-seat-photos", () => ({ getSeatPhotos: getSeatPhotosMock }));
vi.mock("@/features/bookings/actions/get-booking-photo-link.action", () => ({ getBookingPhotoLinkAction: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock, useRouter: () => ({ refresh: vi.fn() }) }));

import SeatPhotosPage from "@/app/(admin)/seats/[id]/photos/page";

const params = Promise.resolve({ id: "s-1" });

describe("SeatPhotosPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    getSeatByIdMock.mockReset();
    getSeatByIdMock.mockResolvedValue({ id: "s-1", serial_number: "SEAT-0001", airport: { name: "Noi Bai", code: "HAN" } });
    getSeatPhotosMock.mockReset();
    getSeatPhotosMock.mockResolvedValue({ photos: [], failed: false, time_zone: "Asia/Ho_Chi_Minh" });
  });

  it("should show the photos of the seat with the way back to the seat history", async () => {
    const html = renderToStaticMarkup(await SeatPhotosPage({ params }));

    expect(html).toContain("Seat history · SEAT-0001 · Noi Bai (HAN)");
    expect(html).toContain('href="/seats/s-1"');
    expect(html).toContain("Photos added to this seat will appear here.");
  });

  it("should check the seats permission on the server before reading anything", async () => {
    requirePermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(SeatPhotosPage({ params })).rejects.toThrow("FORBIDDEN");
    expect(getSeatPhotosMock).not.toHaveBeenCalled();
  });

  it("should return not found when the seat does not exist", async () => {
    getSeatByIdMock.mockResolvedValue(null);

    await expect(SeatPhotosPage({ params })).rejects.toThrow("NOT_FOUND");
  });
});
