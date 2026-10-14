import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError, getPublicEnv } from "@/lib/config/env";

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_VAR = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

describe("getPublicEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return the validated values when both variables are set", () => {
    vi.stubEnv(URL_VAR, "https://example.supabase.co");
    vi.stubEnv(KEY_VAR, "publishable-key");

    expect(getPublicEnv()).toEqual({
      supabase_url: "https://example.supabase.co",
      supabase_publishable_key: "publishable-key",
    });
  });

  it("should throw a configuration error naming the variable when the URL is missing", () => {
    vi.stubEnv(URL_VAR, "");
    vi.stubEnv(KEY_VAR, "publishable-key");

    expect(() => getPublicEnv()).toThrow(ConfigurationError);
    expect(() => getPublicEnv()).toThrow(URL_VAR);
  });

  it("should list both variables in one error when both are missing", () => {
    vi.stubEnv(URL_VAR, "");
    vi.stubEnv(KEY_VAR, "");

    expect(() => getPublicEnv()).toThrow(
      new RegExp(`${URL_VAR}.*${KEY_VAR}`),
    );
  });

  it("should throw when the publishable key is only whitespace", () => {
    vi.stubEnv(URL_VAR, "https://example.supabase.co");
    vi.stubEnv(KEY_VAR, "   ");

    expect(() => getPublicEnv()).toThrow(KEY_VAR);
  });

  it("should throw when the URL does not use http or https", () => {
    vi.stubEnv(URL_VAR, "ftp://example.supabase.co");
    vi.stubEnv(KEY_VAR, "publishable-key");

    expect(() => getPublicEnv()).toThrow(URL_VAR);
  });

  it("should not include the invalid value in the error message", () => {
    vi.stubEnv(URL_VAR, "not-a-url-secret-value");
    vi.stubEnv(KEY_VAR, "publishable-key");

    let message = "";
    try {
      getPublicEnv();
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(URL_VAR);
    expect(message).not.toContain("not-a-url-secret-value");
  });
});

describe("client-exposed configuration", () => {
  function listSourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return listSourceFiles(full);
      return /\.(ts|tsx)$/.test(name) ? [full] : [];
    });
  }

  it("should not expose a secret or service-role key through a NEXT_PUBLIC_ variable", () => {
    const offenders = listSourceFiles(join(process.cwd(), "src")).filter(
      (file) =>
        !/\.test\.tsx?$/.test(file) &&
        /NEXT_PUBLIC_\w*(SECRET|SERVICE_ROLE)/i.test(
          readFileSync(file, "utf8"),
        ),
    );

    expect(offenders).toEqual([]);
  });
});
