import { describe, expect, it } from "vitest";

import { isCronAuthorized } from "./cron-auth";

const TOKEN = "scheduler-token-1";

describe("isCronAuthorized", () => {
  it("should accept a bearer token that is the secret", () => {
    expect(isCronAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("should refuse a bearer token that is not the secret", () => {
    expect(isCronAuthorized("Bearer another-value", TOKEN)).toBe(false);
  });

  it("should refuse a token that only starts like the secret", () => {
    expect(isCronAuthorized(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
  });

  it("should refuse a request with no Authorization header", () => {
    expect(isCronAuthorized(null, TOKEN)).toBe(false);
  });

  it("should refuse a header that is not a bearer token", () => {
    expect(isCronAuthorized(`Basic ${TOKEN}`, TOKEN)).toBe(false);
    expect(isCronAuthorized(TOKEN, TOKEN)).toBe(false);
    expect(isCronAuthorized("Bearer", TOKEN)).toBe(false);
  });
});
