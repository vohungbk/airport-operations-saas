import { describe, expect, it } from "vitest";

import { isFrameworkSignal, runClientAction } from "@/lib/actions/run-client-action";

const NETWORK = { code: "NETWORK_ERROR", message: "Could not reach the server. Your entries are kept: try again." };

/** The error Next throws for `redirect()`, `notFound()` and `forbidden()`. */
const signal = (digest: string) => Object.assign(new Error("signal"), { digest });

describe("runClientAction (VI-F04-S17)", () => {
  it("should return the result of the action when it succeeds", async () => {
    await expect(runClientAction(async () => ({ success: true }), NETWORK)).resolves.toEqual({ success: true });
  });

  it("should pass an error result from the action through unchanged", async () => {
    const result = { success: false, error: { code: "CONFLICT", message: "Already there." } };

    await expect(runClientAction(async () => result, NETWORK)).resolves.toBe(result);
  });

  it("should return the network error, not a success and not a throw, when the call does not get through (E10)", async () => {
    const result = await runClientAction(async () => {
      throw new TypeError("Failed to fetch");
    }, NETWORK);

    expect(result).toEqual({ success: false, error: NETWORK });
  });

  it("should not put the raw failure in what the user sees", async () => {
    const result = await runClientAction(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
    }, NETWORK);

    expect(JSON.stringify(result)).not.toContain("10.0.0.5");
  });

  it("should treat an error with a digest that is not a Next signal as a network failure", async () => {
    const result = await runClientAction(async () => {
      throw signal("1234567890");
    }, NETWORK);

    expect(result.success).toBe(false);
  });

  it.each([
    ["redirect", "NEXT_REDIRECT;replace;/forbidden;307;"],
    ["forbidden, a user who lost the permission (E11)", "NEXT_HTTP_ERROR_FALLBACK;403"],
    ["not found", "NEXT_HTTP_ERROR_FALLBACK;404"],
  ])("should throw the %s signal of Next again so the framework handles it", async (_name, digest) => {
    await expect(
      runClientAction(async () => {
        throw signal(digest);
      }, NETWORK),
    ).rejects.toMatchObject({ digest });
  });
});

describe("isFrameworkSignal", () => {
  it.each([null, undefined, "NEXT_REDIRECT", {}, { digest: 403 }, new Error("x")])(
    "should not take %s for a signal of Next",
    (value) => {
      expect(isFrameworkSignal(value)).toBe(false);
    },
  );

  it("should take an error whose digest starts with NEXT_ for a signal of Next", () => {
    expect(isFrameworkSignal(signal("NEXT_HTTP_ERROR_FALLBACK;403"))).toBe(true);
  });
});
