import { describe, expect, it } from "vitest";

import { runBookingAction } from "@/features/bookings/lib/run-booking-action";

describe("runBookingAction", () => {
  it("should return the result of the action when it succeeds", async () => {
    await expect(runBookingAction(async () => ({ success: true }))).resolves.toEqual({
      success: true,
    });
  });

  it("should pass an error result from the action through unchanged", async () => {
    const result = {
      success: false,
      error: { code: "STALE_DATA" as const, message: "stale" },
    };

    await expect(runBookingAction(async () => result)).resolves.toBe(result);
  });

  it("should return a network error, not a success and not a throw, when the call fails", async () => {
    const result = await runBookingAction(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NETWORK_ERROR");
    expect(result.error?.message).toContain("Your input is kept");
  });

  it("should not put the raw failure in the message the user sees", async () => {
    const result = await runBookingAction(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
    });

    expect(result.error?.message).not.toContain("10.0.0.5");
  });

  it.each([
    ["redirect", "NEXT_REDIRECT;replace;/forbidden;307;"],
    ["not found", "NEXT_HTTP_ERROR_FALLBACK;404"],
  ])("should re-throw a Next %s so navigation still happens", async (_, digest) => {
    const signal = Object.assign(new Error("NEXT_SIGNAL"), { digest });

    await expect(
      runBookingAction(async () => {
        throw signal;
      }),
    ).rejects.toBe(signal);
  });
});
