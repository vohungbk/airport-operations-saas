import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthUserMock, singleMock, eqMock, selectMock, fromMock } =
  vi.hoisted(() => {
    const singleMock = vi.fn();
    const eqMock = vi.fn(() => ({ single: singleMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    const getAuthUserMock = vi.fn();

    return { getAuthUserMock, singleMock, eqMock, selectMock, fromMock };
  });

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: getAuthUserMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import {
  getCurrentUser,
  requireAuth,
  requirePermission,
  requireRole,
} from "@/lib/auth/current-user";

const AUTH_USER = { id: "user-1", email: "user@example.com" };

const ACTIVE_ROW = {
  id: "user-1",
  email: "user@example.com",
  full_name: "Jane Doe",
  role: "technician" as const,
  partner_id: null,
  is_active: true,
};

function resetMocks() {
  getAuthUserMock.mockReset();
  singleMock.mockReset();
  eqMock.mockClear();
  selectMock.mockClear();
  fromMock.mockClear();
}

describe("getCurrentUser", () => {
  beforeEach(resetMocks);

  it("should return null when there is no session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("should return the AppUser when the profile row is active", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: ACTIVE_ROW, error: null });

    const user = await getCurrentUser();

    expect(user).toEqual(ACTIVE_ROW);
  });

  it("should scope the users lookup to the caller's own authenticated id (self-lookup, not a list query)", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: ACTIVE_ROW, error: null });

    await getCurrentUser();

    expect(fromMock).toHaveBeenCalledWith("users");
    expect(eqMock).toHaveBeenCalledWith("id", "user-1");
    // .single() forces exactly one row - never a list/array result that
    // could leak another user's data.
    expect(singleMock).toHaveBeenCalledTimes(1);
  });

  it("should return null when the public.users row is missing", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: null, error: null });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it("should return null (fail closed) when the query errors", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "connection failed" },
    });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it("should return null (fail closed) when the profile is inactive, even with a live session", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, is_active: false },
      error: null,
    });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it("should return the requesting user's own partner_id, not any other row's", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: {
        ...ACTIVE_ROW,
        role: "partner_user",
        partner_id: "partner-abc",
      },
      error: null,
    });

    const user = await getCurrentUser();

    expect(user?.partner_id).toBe("partner-abc");
  });
});

describe("requireAuth", () => {
  beforeEach(resetMocks);

  it("should redirect to /login when there is no session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });

  it("should redirect to /forbidden when authenticated but the public.users row is missing", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: null, error: null });

    await expect(requireAuth()).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("should redirect to /forbidden when authenticated but is_active is false", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, is_active: false },
      error: null,
    });

    await expect(requireAuth()).rejects.toThrow("REDIRECT:/forbidden");
  });

  it("should return the AppUser without redirecting when authenticated with an active profile", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: ACTIVE_ROW, error: null });

    const user = await requireAuth();

    expect(user).toEqual(ACTIVE_ROW);
  });
});

describe("requireRole", () => {
  beforeEach(resetMocks);

  it("should redirect to /login when there is no session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    await expect(requireRole(["operations_manager"])).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("should return the user when their role is in the allowed list", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: ACTIVE_ROW, error: null });

    const user = await requireRole(["technician"]);

    expect(user).toEqual(ACTIVE_ROW);
  });

  it("should redirect to /forbidden when the user's role is not in the allowed list", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, role: "partner_user" },
      error: null,
    });

    await expect(requireRole(["operations_manager"])).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });

  it("should let admin through even when admin is not in the allowed list", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, role: "admin" },
      error: null,
    });

    const user = await requireRole(["operations_manager"]);

    expect(user.role).toBe("admin");
  });
});

describe("requirePermission", () => {
  beforeEach(resetMocks);

  it("should redirect to /login when there is no session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    await expect(requirePermission("jobs:view_assigned")).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("should return the user when their role holds the required permission", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: ACTIVE_ROW, error: null });

    const user = await requirePermission("jobs:view_assigned");

    expect(user).toEqual(ACTIVE_ROW);
  });

  it("should redirect to /forbidden when the user's role lacks the required permission", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, role: "partner_user" },
      error: null,
    });

    await expect(requirePermission("jobs:view_assigned")).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });

  it("should let admin through a permission check even without an explicit grant", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, role: "admin" },
      error: null,
    });

    const user = await requirePermission("finance:view");

    expect(user.role).toBe("admin");
  });
});
