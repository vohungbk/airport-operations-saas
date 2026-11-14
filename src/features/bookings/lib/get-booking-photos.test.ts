import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { BOOKING_PHOTOS_LIMIT, BOOKING_PHOTOS_SELECT, getBookingPhotos } from "@/features/bookings/lib/get-booking-photos";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";
const ROW = (id: string) => ({
  id,
  type: "installation",
  storage_path: `${BOOKING_ID}/installation/${id}.jpg`,
  caption: "Seat fitted",
  created_at: "2026-11-14T10:00:00Z",
  uploader: { full_name: "Ana Tran" },
});

const SIGNED_TWO = {
  data: [1, 2].map((n) => ({ path: `${BOOKING_ID}/installation/p-${n}.jpg`, signedUrl: `https://signed/${n}` })),
  error: null,
};

function mockClient(rows: { data: unknown; error: unknown }, signed: { data: unknown; error: unknown } = { data: [], error: null }) {
  const limit = vi.fn().mockResolvedValue(rows);
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const createSignedUrls = vi.fn().mockResolvedValue(signed);
  const storageFrom = vi.fn(() => ({ createSignedUrls }));
  createClientMock.mockResolvedValue({ from, storage: { from: storageFrom } });
  return { from, select, eq, order, limit, storageFrom, createSignedUrls };
}

describe("getBookingPhotos", () => {
  beforeEach(() => createClientMock.mockReset());

  it("should return nothing without querying when the id is malformed", async () => {
    await expect(getBookingPhotos("not-an-id")).resolves.toEqual({ photos: [], failed: false });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("should read the photos newest first and sign every address in one call", async () => {
    const q = mockClient(
      { data: [ROW("p-1"), ROW("p-2")], error: null },
      SIGNED_TWO,
    );

    const result = await getBookingPhotos(BOOKING_ID);

    expect(q.select).toHaveBeenCalledWith(BOOKING_PHOTOS_SELECT);
    expect(q.eq).toHaveBeenCalledWith("booking_id", BOOKING_ID);
    expect(q.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(q.limit).toHaveBeenCalledWith(BOOKING_PHOTOS_LIMIT);
    expect(q.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(result.failed).toBe(false);
    expect(result.photos).toEqual([
      expect.objectContaining({ id: "p-1", url: "https://signed/1", uploader_name: "Ana Tran", taken_at: "2026-11-14T10:00:00Z" }),
      expect.objectContaining({ id: "p-2", url: "https://signed/2" }),
    ]);
  });

  it("should list the same photo uploaded twice as two photos, each with its own time (FO-F06-S08 AC02)", async () => {
    mockClient(
      { data: [{ ...ROW("p-2"), created_at: "2026-11-14T10:05:00Z" }, ROW("p-1")], error: null },
      SIGNED_TWO,
    );

    const { photos } = await getBookingPhotos(BOOKING_ID);

    expect(photos.map((photo) => [photo.id, photo.taken_at])).toEqual([
      ["p-2", "2026-11-14T10:05:00Z"],
      ["p-1", "2026-11-14T10:00:00Z"],
    ]);
  });

  it.each([
    ["the rows cannot be read", { data: null, error: { message: "boom" } }, undefined],
    ["the addresses cannot be signed", { data: [ROW("p-1")], error: null }, { data: null, error: { message: "boom" } }],
  ])("should report a failure, not throw, when %s", async (_name, rows, signed) => {
    mockClient(rows, signed);

    await expect(getBookingPhotos(BOOKING_ID)).resolves.toEqual({ photos: [], failed: true });
  });
});
