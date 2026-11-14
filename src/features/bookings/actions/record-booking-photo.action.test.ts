import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: rpcMock })) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN");
  }),
}));

import { recordBookingPhotoAction } from "@/features/bookings/actions/record-booking-photo.action";

const BOOKING_ID = "b0000000-0000-0000-0000-000000000123";
const INPUT = {
  booking_id: BOOKING_ID,
  type: "installation",
  storage_path: `${BOOKING_ID}/installation/p-1.jpg`,
  caption: " Seat fitted ",
};

describe("recordBookingPhotoAction", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    requireAuthMock.mockResolvedValue({ id: "u-1", role: "operations_manager" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ error: null });
    revalidatePathMock.mockReset();
  });

  it("should link the photo to the booking and refresh the booking page", async () => {
    await expect(recordBookingPhotoAction(INPUT)).resolves.toEqual({ success: true });

    expect(requireAuthMock).toHaveBeenCalled();
    expect(rpcMock).toHaveBeenCalledWith("record_booking_photo", {
      p_booking_id: BOOKING_ID,
      p_type: "installation",
      p_path: INPUT.storage_path,
      p_caption: "Seat fitted",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}`);
  });

  it.each([
    ["a caption over 200 characters", { caption: "a".repeat(201) }],
    ["a path of another booking", { storage_path: "other/installation/p-1.jpg" }],
  ])("should return a validation error and store nothing with %s", async (_name, change) => {
    const result = await recordBookingPhotoAction({ ...INPUT, ...change });

    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should not call the database when nobody is signed in", async () => {
    requireAuthMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(recordBookingPhotoAction(INPUT)).rejects.toThrow("FORBIDDEN");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should show the forbidden state when the database refuses a technician who is not assigned (AC03)", async () => {
    requireAuthMock.mockResolvedValue({ id: "u-2", role: "technician" });
    rpcMock.mockResolvedValue({ error: { code: "42501", message: "Not allowed" } });

    await expect(recordBookingPhotoAction(INPUT)).rejects.toThrow("FORBIDDEN");
  });

  it("should return the mapped error when the photo is not in the bucket", async () => {
    rpcMock.mockResolvedValue({ error: { code: "22023", message: "A photo is required" } });

    await expect(recordBookingPhotoAction(INPUT)).resolves.toEqual({
      success: false,
      error: expect.objectContaining({ code: "PHOTO_REQUIRED" }),
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
