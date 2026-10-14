import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithPasswordMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword: signInWithPasswordMock },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

import { loginAction } from "@/features/auth/actions/login.action";

describe("loginAction", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
  });

  it("should redirect to /dashboard on successful sign-in", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });

    await expect(
      loginAction({ email: "user@example.com", password: "password123" }),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("should return a validation error without calling Supabase when input is invalid", async () => {
    const result = await loginAction({ email: "not-an-email", password: "" });

    expect(result).toEqual({ error: "Enter a valid email and password." });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("should return a generic invalid-credentials message on wrong password, without leaking which field was wrong", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });

    const result = await loginAction({
      email: "user@example.com",
      password: "wrong-password",
    });

    expect(result).toEqual({ error: "Invalid email or password." });
  });

  it("should return an email-confirmation message when Supabase reports email_not_confirmed", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" },
    });

    const result = await loginAction({
      email: "user@example.com",
      password: "password123",
    });

    expect(result).toEqual({
      error: "Please confirm your email address before signing in.",
    });
  });

  it("should return a network message instead of invalid credentials when Supabase cannot be reached", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: new AuthRetryableFetchError("fetch failed", 0),
    });

    const result = await loginAction({
      email: "user@example.com",
      password: "test-value-password",
    });

    expect(result.error).toContain("could not reach the sign-in service");
    expect(result.error).not.toBe("Invalid email or password.");
  });

  it("should allow signing in again after a network failure", async () => {
    signInWithPasswordMock
      .mockResolvedValueOnce({
        error: new AuthRetryableFetchError("fetch failed", 0),
      })
      .mockResolvedValueOnce({ error: null });

    const input = { email: "user@example.com", password: "password123" };
    const first = await loginAction(input);

    expect(first.error).toBeTruthy();
    await expect(loginAction(input)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("should return a rate-limit message when Supabase reports too many requests", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: new AuthApiError(
        "Request rate limit reached",
        429,
        "over_request_rate_limit",
      ),
    });

    const result = await loginAction({
      email: "user@example.com",
      password: "test-value-password",
    });

    expect(result).toEqual({
      error: "Too many sign-in attempts. Wait a moment and try again.",
    });
  });

  it("should return a generic message instead of throwing when Supabase throws unexpectedly", async () => {
    signInWithPasswordMock.mockRejectedValue(new Error("boom"));

    const result = await loginAction({
      email: "user@example.com",
      password: "test-value-password",
    });

    expect(result).toEqual({ error: "Something went wrong. Try again." });
  });
});
