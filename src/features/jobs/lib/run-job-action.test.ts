import { describe, expect, it } from "vitest";

import { runJobAction } from "@/features/jobs/lib/run-job-action";

describe("runJobAction", () => {
  it("should return the result of the action when it succeeds", async () => {
    await expect(runJobAction(async () => ({ success: true }))).resolves.toEqual(
      { success: true },
    );
  });

  it("should pass an error result from the action through unchanged", async () => {
    const result = {
      success: false,
      error: { code: "STALE_DATA" as const, message: "stale" },
    };

    await expect(runJobAction(async () => result)).resolves.toBe(result);
  });

  it("should return a network error instead of throwing when the call fails", async () => {
    const result = await runJobAction(async () => {
      throw new TypeError("Failed to fetch");
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("NETWORK_ERROR");
    expect(result.error?.message).toContain("Your input is kept");
  });

  it("should re-throw a Next redirect so navigation still happens", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/jobs/j-1;307;",
    });

    await expect(
      runJobAction(async () => {
        throw redirect;
      }),
    ).rejects.toBe(redirect);
  });

  it("should re-throw a Next not-found signal", async () => {
    const notFound = Object.assign(new Error("NEXT_NOT_FOUND"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });

    await expect(
      runJobAction(async () => {
        throw notFound;
      }),
    ).rejects.toBe(notFound);
  });
});
