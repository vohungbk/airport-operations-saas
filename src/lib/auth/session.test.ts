import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaimsMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims: getClaimsMock },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { getAuthUser, requireUser } from "@/lib/auth/session";

describe("getAuthUser", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
  });

  it("should return the user id/email when a valid session exists", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-1", email: "user@example.com" } },
      error: null,
    });

    const user = await getAuthUser();

    expect(user).toEqual({ id: "user-1", email: "user@example.com" });
  });

  it("should return null when there is no session", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null }, error: null });

    const user = await getAuthUser();

    expect(user).toBeNull();
  });

  it("should return null when Supabase returns an error validating the token", async () => {
    getClaimsMock.mockResolvedValue({
      data: null,
      error: { message: "invalid token" },
    });

    const user = await getAuthUser();

    expect(user).toBeNull();
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
  });

  it("should return the user without redirecting when authenticated", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-1", email: "user@example.com" } },
      error: null,
    });

    const user = await requireUser();

    expect(user).toEqual({ id: "user-1", email: "user@example.com" });
  });

  it("should redirect to /login when there is no session", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null }, error: null });

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });
});
