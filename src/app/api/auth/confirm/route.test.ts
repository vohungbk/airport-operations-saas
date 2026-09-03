import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyOtpMock = vi.fn();
const syncUserProfileMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { verifyOtp: verifyOtpMock },
  })),
}));

vi.mock("@/features/auth/lib/sync-user-profile", () => ({
  syncUserProfile: (...args: unknown[]) => syncUserProfileMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { GET } from "@/app/api/auth/confirm/route";

function makeRequest(query: string): NextRequest {
  return new NextRequest(
    new URL(`/api/auth/confirm${query}`, "http://localhost:3000"),
  );
}

describe("GET /api/auth/confirm", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
    syncUserProfileMock.mockReset();
    syncUserProfileMock.mockResolvedValue({ error: null });
  });

  it("should verify the token, sync the profile, and redirect to /dashboard for a successful signup confirmation", async () => {
    verifyOtpMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "user@example.com",
          user_metadata: { full_name: "Jane Doe" },
        },
      },
      error: null,
    });

    await expect(
      GET(makeRequest("?token_hash=abc&type=signup")),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(verifyOtpMock).toHaveBeenCalledWith({
      token_hash: "abc",
      type: "signup",
    });
    expect(syncUserProfileMock).toHaveBeenCalledWith(expect.anything(), {
      id: "user-1",
      email: "user@example.com",
      full_name: "Jane Doe",
    });
  });

  it("should redirect to /forbidden?reason=confirm_profile_failed when the post-confirmation profile write fails", async () => {
    verifyOtpMock.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "user2@example.com",
          user_metadata: { full_name: "Jane Doe" },
        },
      },
      error: null,
    });
    syncUserProfileMock.mockResolvedValue({
      error: { message: "rls denied" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      GET(makeRequest("?token_hash=abc&type=signup")),
    ).rejects.toThrow("REDIRECT:/forbidden?reason=confirm_profile_failed");

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("should redirect to /login without calling verifyOtp when token_hash or type is missing", async () => {
    await expect(GET(makeRequest(""))).rejects.toThrow("REDIRECT:/login");
    expect(verifyOtpMock).not.toHaveBeenCalled();
  });

  it("should redirect to /reset-password for a recovery token regardless of verifyOtp outcome", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: null },
      error: { message: "expired" },
    });

    await expect(
      GET(makeRequest("?token_hash=abc&type=recovery")),
    ).rejects.toThrow("REDIRECT:/reset-password");

    expect(syncUserProfileMock).not.toHaveBeenCalled();
  });

  it("should redirect to /login when verifyOtp returns an error for a non-recovery type", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { user: null },
      error: { message: "expired or invalid token" },
    });

    await expect(
      GET(makeRequest("?token_hash=abc&type=signup")),
    ).rejects.toThrow("REDIRECT:/login");

    expect(syncUserProfileMock).not.toHaveBeenCalled();
  });

  it("should redirect to /dashboard without syncing the profile for a non-signup, non-recovery otp type", async () => {
    verifyOtpMock.mockResolvedValue({
      data: {
        user: { id: "user-3", email: "user3@example.com", user_metadata: {} },
      },
      error: null,
    });

    await expect(
      GET(makeRequest("?token_hash=abc&type=email_change")),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(syncUserProfileMock).not.toHaveBeenCalled();
  });

  it("should fall back to an empty full_name when user_metadata.full_name is missing", async () => {
    verifyOtpMock.mockResolvedValue({
      data: {
        user: { id: "user-4", email: "user4@example.com", user_metadata: {} },
      },
      error: null,
    });

    await expect(
      GET(makeRequest("?token_hash=abc&type=signup")),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(syncUserProfileMock).toHaveBeenCalledWith(expect.anything(), {
      id: "user-4",
      email: "user4@example.com",
      full_name: "",
    });
  });
});
