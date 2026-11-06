import { describe, expect, it } from "vitest";

import { ProviderError, toProviderErrorKind } from "./provider-error";

describe("toProviderErrorKind", () => {
  it("should keep the kind of a provider error", () => {
    expect(toProviderErrorKind(new ProviderError("rate_limited", "limit"))).toBe("rate_limited");
  });

  it.each([
    ["a timeout", new DOMException("timed out", "TimeoutError")],
    ["an abort", new DOMException("aborted", "AbortError")],
  ])("should call %s a timeout", (_case, error) => {
    expect(toProviderErrorKind(error)).toBe("timeout");
  });

  it("should call an error it does not know unavailable", () => {
    expect(toProviderErrorKind(new TypeError("fetch failed"))).toBe("unavailable");
  });

  it("should call a value that is not an error unavailable", () => {
    expect(toProviderErrorKind("boom")).toBe("unavailable");
  });
});
