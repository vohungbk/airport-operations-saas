import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppUrl } from "@/lib/config/app-url";

describe("getAppUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return the configured address without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com/");

    expect(getAppUrl()).toBe("https://app.example.com");
  });

  it("should fall back to the local address outside production when it is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("should refuse to run in production when it is not set, naming the variable and no value", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getAppUrl()).toThrow("NEXT_PUBLIC_APP_URL");
  });

  it.each([["not a url"], ["javascript:alert(1)"], ["ftp://example.com"]])(
    "should refuse %s",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", value);

      expect(() => getAppUrl()).toThrow("NEXT_PUBLIC_APP_URL");
    },
  );
});
