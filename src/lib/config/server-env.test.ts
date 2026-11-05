import { describe, expect, it } from "vitest";

import { ConfigurationError } from "@/lib/config/env";

import { getCronSecret, getServiceRoleKey } from "./server-env";

describe("getCronSecret", () => {
  it("should return the secret without surrounding spaces", () => {
    expect(getCronSecret({ CRON_SECRET: "  abc  " })).toBe("abc");
  });

  it("should name the variable, not a value, when the secret is missing", () => {
    expect(() => getCronSecret({})).toThrow(ConfigurationError);
    expect(() => getCronSecret({})).toThrow(/CRON_SECRET/);
  });

  it("should refuse a secret that is only spaces", () => {
    expect(() => getCronSecret({ CRON_SECRET: "   " })).toThrow(ConfigurationError);
  });
});

describe("getServiceRoleKey", () => {
  it("should return the key", () => {
    expect(getServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: "key-1" })).toBe("key-1");
  });

  it("should name the variable and never print a value when the key is missing", () => {
    expect(() => getServiceRoleKey({ OTHER: "secret-value" })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => getServiceRoleKey({ OTHER: "secret-value" })).not.toThrow(/secret-value/);
  });
});
