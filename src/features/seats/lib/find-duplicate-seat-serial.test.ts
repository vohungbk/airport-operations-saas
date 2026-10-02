import { describe, expect, it, vi } from "vitest";

import { findDuplicateSeatSerial } from "@/features/seats/lib/find-duplicate-seat-serial";

function clientReturning(result: { data?: unknown[] | null; error?: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, from, eq };
}

describe("findDuplicateSeatSerial", () => {
  it("should report a duplicate when a seat already has the serial number", async () => {
    const { client, from, eq } = clientReturning({ data: [{ id: "s1" }] });

    await expect(findDuplicateSeatSerial(client, "SEAT-0001")).resolves.toEqual({
      duplicate: true,
    });
    expect(from).toHaveBeenCalledWith("seats");
    expect(eq).toHaveBeenCalledWith("serial_number", "SEAT-0001");
  });

  it("should report no duplicate when no seat has the serial number", async () => {
    const { client } = clientReturning({ data: [] });

    await expect(findDuplicateSeatSerial(client, "SEAT-NEW")).resolves.toEqual({
      duplicate: false,
    });
  });

  it("should return the database error instead of a duplicate flag when the query fails", async () => {
    const error = { code: "42501", message: "denied" };
    const { client } = clientReturning({ data: null, error });

    await expect(findDuplicateSeatSerial(client, "SEAT-0001")).resolves.toEqual({
      error,
    });
  });
});
