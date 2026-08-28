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
});
