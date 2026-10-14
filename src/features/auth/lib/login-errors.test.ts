import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  LOGIN_ERROR_MESSAGES,
  mapLoginError,
  submitLogin,
} from "@/features/auth/lib/login-errors";

describe("mapLoginError", () => {
  it("should map a retryable fetch error to the network message", () => {
    expect(mapLoginError(new AuthRetryableFetchError("fetch failed", 0))).toBe(
      LOGIN_ERROR_MESSAGES.network,
    );
  });

  it("should map a 429 response to the rate-limit message even without a code", () => {
    expect(
      mapLoginError(new AuthApiError("Too many requests", 429, undefined)),
    ).toBe(LOGIN_ERROR_MESSAGES.rate_limited);
  });

  it("should keep wrong password and unknown account indistinguishable", () => {
    const wrongPassword = new AuthApiError(
      "Invalid login credentials",
      400,
      "invalid_credentials",
    );

    expect(mapLoginError(wrongPassword)).toBe(
      LOGIN_ERROR_MESSAGES.invalid_credentials,
    );
  });
});

describe("submitLogin", () => {
  const values = { email: "user@example.com", password: "password123" };

  it("should return null when the action succeeds without an error", async () => {
    await expect(submitLogin(async () => undefined, values)).resolves.toBeNull();
  });

  it("should return the action error message when sign-in fails", async () => {
    const login = async () => ({ error: "Invalid email or password." });

    await expect(submitLogin(login, values)).resolves.toBe(
      "Invalid email or password.",
    );
  });

  it("should return the network message when the action call rejects", async () => {
    const login = async () => {
      throw new TypeError("Failed to fetch");
    };

    await expect(submitLogin(login, values)).resolves.toBe(
      LOGIN_ERROR_MESSAGES.network,
    );
  });

  it("should re-throw the redirect so a successful sign-in still navigates", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/dashboard;307;",
    });
    const login = async () => {
      throw redirectError;
    };

    await expect(submitLogin(login, values)).rejects.toBe(redirectError);
  });
});
