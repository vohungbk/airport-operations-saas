import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.fn();
const upsertMock = vi.fn();
const fromMock = vi.fn(() => ({ upsert: upsertMock }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signUp: signUpMock },
    from: fromMock,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { signupAction } from "@/features/auth/actions/signup.action";

const VALID_INPUT = {
  email: "user@example.com",
  full_name: "Jane Doe",
  password: "password123",
  confirm_password: "password123",
};

describe("signupAction", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    upsertMock.mockReset();
    fromMock.mockClear();
    upsertMock.mockResolvedValue({ error: null });
  });

  it("should sign up, write the profile row, and redirect to /dashboard when a session is returned", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-1", identities: [{ id: "identity-1" }] },
        session: { access_token: "token" },
      },
      error: null,
    });

    await expect(signupAction(VALID_INPUT)).rejects.toThrow(
      "REDIRECT:/dashboard",
    );

    expect(fromMock).toHaveBeenCalledWith("users");
    expect(upsertMock).toHaveBeenCalledWith(
      {
        id: "user-1",
        email: "user@example.com",
        full_name: "Jane Doe",
        role: "partner_staff",
        partner_id: null,
      },
      { onConflict: "id" },
    );
  });

  it("should return a validation error without calling Supabase when the email is invalid", async () => {
    const result = await signupAction({ ...VALID_INPUT, email: "not-an-email" });

    expect(result).toEqual({
      success: false,
      message: "Check the form and try again.",
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("should return a validation error when password and confirm_password do not match", async () => {
    const result = await signupAction({
      ...VALID_INPUT,
      confirm_password: "different123",
    });

    expect(result).toEqual({
      success: false,
      message: "Check the form and try again.",
    });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("should show the generic check-email message and skip the profile write for an obfuscated duplicate email", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-2", identities: [] },
        session: null,
      },
      error: null,
    });

    const result = await signupAction(VALID_INPUT);

    expect(result).toEqual({
      success: true,
      message:
        "Check your email to confirm your account before signing in.",
    });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("should show the check-email message without redirecting when signup succeeds but no session is returned", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-3", identities: [{ id: "identity-1" }] },
        session: null,
      },
      error: null,
    });

    const result = await signupAction(VALID_INPUT);

    expect(result).toEqual({
      success: true,
      message:
        "Check your email to confirm your account before signing in.",
    });
    expect(upsertMock).toHaveBeenCalled();
  });

  it("should always hardcode role: partner_staff and partner_id: null even when the input carries injected role/partner_id fields", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "attacker-id", identities: [{ id: "identity-1" }] },
        session: { access_token: "token" },
      },
      error: null,
    });

    const maliciousInput = {
      ...VALID_INPUT,
      email: "attacker@example.com",
      // Extra fields a malicious client could try to sneak in - the
      // schema has no `role`/`partner_id` field, and the action must
      // never read them even if they somehow reached it.
      role: "operator_admin",
      partner_id: "11111111-1111-1111-1111-111111111111",
    };

    await expect(signupAction(maliciousInput)).rejects.toThrow(
      "REDIRECT:/dashboard",
    );

    expect(upsertMock).toHaveBeenCalledWith(
      {
        id: "attacker-id",
        email: "attacker@example.com",
        full_name: "Jane Doe",
        role: "partner_staff",
        partner_id: null,
      },
      { onConflict: "id" },
    );
  });

  it("should return a generic error and not redirect when the profile upsert fails", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-4", identities: [{ id: "identity-1" }] },
        session: { access_token: "token" },
      },
      error: null,
    });
    upsertMock.mockResolvedValue({ error: { message: "db error" } });

    const result = await signupAction(VALID_INPUT);

    expect(result).toEqual({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  });
});
