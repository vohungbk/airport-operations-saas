import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn());
const createSignedUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({ select: () => ({ eq: eqMock.mockReturnValue({ maybeSingle: maybeSingleMock }) }) }),
    storage: { from: () => ({ createSignedUrl: createSignedUrlMock }) },
  })),
}));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN");
  }),
}));

import { getBookingPhotoLinkAction } from "@/features/bookings/actions/get-booking-photo-link.action";
import { BOOKING_PHOTO_SIGNED_URL_SECONDS } from "@/features/bookings/lib/booking-photos";

const PHOTO_ID = "c0000000-0000-0000-0000-000000000001";
const PATH = "b0000000-0000-0000-0000-000000000123/installation/p-1.jpg";

describe("getBookingPhotoLinkAction", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: { storage_path: PATH }, error: null });
    createSignedUrlMock.mockReset();
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: "https://files.test/signed?token=new" }, error: null });
  });

  it("should return a new short-lived signed link each time the photo is opened", async () => {
    await expect(getBookingPhotoLinkAction({ photo_id: PHOTO_ID })).resolves.toEqual({
      success: true,
      url: "https://files.test/signed?token=new",
    });
    await getBookingPhotoLinkAction({ photo_id: PHOTO_ID });

    expect(createSignedUrlMock).toHaveBeenCalledTimes(2);
    expect(createSignedUrlMock).toHaveBeenCalledWith(PATH, BOOKING_PHOTO_SIGNED_URL_SECONDS);
    expect(BOOKING_PHOTO_SIGNED_URL_SECONDS).toBeLessThanOrEqual(10 * 60);
  });

  it("should return a validation error and read nothing when the photo id is not valid", async () => {
    const result = await getBookingPhotoLinkAction({ photo_id: "not-an-id" });

    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it("should return not found and sign nothing when the user cannot see the photo", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await getBookingPhotoLinkAction({ photo_id: PHOTO_ID });

    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "NOT_FOUND" }) });
    expect(createSignedUrlMock).not.toHaveBeenCalled();
  });

  it("should return an internal error without the raw message when signing fails", async () => {
    createSignedUrlMock.mockResolvedValue({ data: null, error: { message: "bucket secret detail" } });

    const result = await getBookingPhotoLinkAction({ photo_id: PHOTO_ID });

    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "INTERNAL_ERROR" }) });
    expect(JSON.stringify(result)).not.toContain("bucket secret detail");
  });

  it("should show the forbidden state when the database refuses the read", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    await expect(getBookingPhotoLinkAction({ photo_id: PHOTO_ID })).rejects.toThrow("FORBIDDEN");
  });

  it("should not call the database when nobody is signed in", async () => {
    requireAuthMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(getBookingPhotoLinkAction({ photo_id: PHOTO_ID })).rejects.toThrow("FORBIDDEN");
    expect(maybeSingleMock).not.toHaveBeenCalled();
  });
});
