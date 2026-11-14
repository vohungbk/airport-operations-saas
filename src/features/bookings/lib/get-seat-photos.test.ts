import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { BOOKING_PHOTOS_LIMIT } from "@/features/bookings/lib/get-booking-photos";
import { getSeatPhotos } from "@/features/bookings/lib/get-seat-photos";

const SEAT_ID = "f0000000-0000-4000-8000-000000000031";
const PATH = (id: string) => `b0000000-0000-4000-8000-000000000001/installation/${id}.jpg`;
const ROW = (id: string, timezone = "Asia/Ho_Chi_Minh") => ({
  id,
  type: "installation",
  storage_path: PATH(id),
  caption: "Harness checked",
  created_at: "2026-11-04T02:12:00Z",
  uploader: { full_name: "Nguyen Van An" },
  booking: { assigned_seat_id: SEAT_ID, airport: { timezone } },
});

function mockClient(rows: { data: unknown; error: unknown }, signed: { data: unknown; error: unknown } = { data: [], error: null }) {
  const limit = vi.fn().mockResolvedValue(rows);
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const createSignedUrls = vi.fn().mockResolvedValue(signed);
  createClientMock.mockResolvedValue({
    from: vi.fn(() => ({ select })),
    storage: { from: vi.fn(() => ({ createSignedUrls })) },
  });
  return { eq, order, limit, createSignedUrls };
}

describe("getSeatPhotos", () => {
  beforeEach(() => createClientMock.mockReset());

  it("should return nothing without querying when the seat id is malformed", async () => {
    await expect(getSeatPhotos("not-an-id")).resolves.toEqual({ photos: [], failed: false, time_zone: "UTC" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should read the photos of the seat newest first, sign them in one call and use the airport time zone", async () => {
    const q = mockClient(
      { data: [ROW("p-1"), ROW("p-2")], error: null },
      { data: ["p-1", "p-2"].map((id) => ({ path: PATH(id), signedUrl: `https://signed/${id}` })), error: null },
    );

    const result = await getSeatPhotos(SEAT_ID);

    expect(q.eq).toHaveBeenCalledWith("booking.assigned_seat_id", SEAT_ID);
    expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(q.limit).toHaveBeenCalledWith(BOOKING_PHOTOS_LIMIT);
    expect(q.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(result.time_zone).toBe("Asia/Ho_Chi_Minh");
    expect(result.photos.map((photo) => photo.url)).toEqual(["https://signed/p-1", "https://signed/p-2"]);
  });

  it("should return an empty list and UTC when the user can read no photo of the seat", async () => {
    mockClient({ data: [], error: null });

    await expect(getSeatPhotos(SEAT_ID)).resolves.toEqual({ photos: [], failed: false, time_zone: "UTC" });
  });

  it("should return failed when the photos cannot be read", async () => {
    mockClient({ data: null, error: { code: "XX000" } });

    await expect(getSeatPhotos(SEAT_ID)).resolves.toEqual({ photos: [], failed: true, time_zone: "UTC" });
  });

  it("should return failed when the addresses cannot be signed", async () => {
    mockClient({ data: [ROW("p-1")], error: null }, { data: null, error: { message: "storage down" } });

    await expect(getSeatPhotos(SEAT_ID)).resolves.toMatchObject({ photos: [], failed: true });
  });
});
