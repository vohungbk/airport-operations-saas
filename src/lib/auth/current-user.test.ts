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
  requireAnyPermission,
  requireAuth,
  requirePartnerScope,
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

/** What getCurrentUser returns for ACTIVE_ROW: no partner, so no partner status. */
const ACTIVE_USER = { ...ACTIVE_ROW, partner_status: null };

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

    expect(user).toEqual(ACTIVE_USER);
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

  it("should return null when the query finds no row for the caller", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "no rows" },
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("should throw, not report forbidden, when the profile cannot be read (network or database error)", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "TypeError: fetch failed" },
    });

    await expect(getCurrentUser()).rejects.toThrow(
      "Could not read the user profile",
    );
  });

  it("should not leak the raw database error in the thrown message", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: null,
      error: { message: "connection to db.internal:5432 refused" },
    });

    await expect(getCurrentUser()).rejects.not.toThrow(/db\.internal/);
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

    expect(user).toEqual(ACTIVE_USER);
  });
});

describe("requireAuth and a partner user with no partner (VI-F03-S05)", () => {
  beforeEach(resetMocks);

  const partnerRow = (partner_id: string | null) => ({
    ...ACTIVE_ROW,
    role: "partner_user" as const,
    partner_id,
    partner: partner_id ? { status: "active" } : null,
  });

  it("should send a partner user with no partner to the no-partner page, not to the app", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: partnerRow(null), error: null });

    await expect(requireAuth()).rejects.toThrow(
      "REDIRECT:/forbidden?reason=no_partner",
    );
  });

  it("should let a partner user with a partner through", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: partnerRow("partner-a"), error: null });

    await expect(requireAuth()).resolves.toMatchObject({ partner_id: "partner-a" });
  });

  it.each(["admin", "operations_manager", "technician"] as const)(
    "should not touch the %s role, which has no partner by design",
    async (role) => {
      getAuthUserMock.mockResolvedValue(AUTH_USER);
      singleMock.mockResolvedValue({
        data: { ...ACTIVE_ROW, role, partner_id: null },
        error: null,
      });

      await expect(requireAuth()).resolves.toMatchObject({ role, partner_id: null });
    },
  );

  it("should apply to every guard built on requireAuth, so no signed-in area is missed", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: partnerRow(null), error: null });

    await expect(requirePermission("bookings:view_own_partner")).rejects.toThrow(
      "no_partner",
    );
    await expect(
      requireAnyPermission(["bookings:view_own_partner", "bookings:manage"]),
    ).rejects.toThrow("no_partner");
    await expect(requireRole(["partner_user"])).rejects.toThrow("no_partner");
  });

  it("should still send an unauthenticated visitor to /login, not to the no-partner page", async () => {
    getAuthUserMock.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("requireAuth and a partner that is not active (VI-F03-S07)", () => {
  beforeEach(resetMocks);

  const partnerRow = (partner: { status: string } | null) => ({
    ...ACTIVE_ROW,
    role: "partner_user" as const,
    partner_id: "partner-a",
    partner,
  });

  it.each(["pending", "suspended", "inactive"])(
    "should send a partner user of a %s partner to the partner-inactive page",
    async (status) => {
      getAuthUserMock.mockResolvedValue(AUTH_USER);
      singleMock.mockResolvedValue({ data: partnerRow({ status }), error: null });

      await expect(requireAuth()).rejects.toThrow(
        "REDIRECT:/forbidden?reason=partner_inactive",
      );
    },
  );

  it("should refuse, not let through, when the partner row cannot be read (the database hides it)", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: partnerRow(null), error: null });

    await expect(requireAuth()).rejects.toThrow("partner_inactive");
  });

  it("should let a partner user of an active partner through, with the partner status on the user", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: partnerRow({ status: "active" }), error: null });

    await expect(requireAuth()).resolves.toMatchObject({
      partner_id: "partner-a",
      partner_status: "active",
    });
  });

  it("should check the partner at every request, so a partner deactivated while the user is signed in is refused at the next one", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock
      .mockResolvedValueOnce({ data: partnerRow({ status: "active" }), error: null })
      .mockResolvedValueOnce({ data: partnerRow({ status: "inactive" }), error: null });

    await expect(requireAuth()).resolves.toMatchObject({ partner_status: "active" });
    await expect(requireAuth()).rejects.toThrow("partner_inactive");
  });

  it("should apply to every guard built on requireAuth", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: partnerRow({ status: "suspended" }), error: null });

    await expect(requirePermission("bookings:view_own_partner")).rejects.toThrow(
      "partner_inactive",
    );
    await expect(requireAnyPermission(["bookings:view_own_partner"])).rejects.toThrow(
      "partner_inactive",
    );
    await expect(requirePartnerScope("bookings:view_own_partner")).rejects.toThrow(
      "partner_inactive",
    );
  });

  it.each(["admin", "operations_manager", "technician"] as const)(
    "should not touch the %s role, whatever the status of any partner",
    async (role) => {
      getAuthUserMock.mockResolvedValue(AUTH_USER);
      singleMock.mockResolvedValue({
        data: { ...ACTIVE_ROW, role, partner_id: null, partner: null },
        error: null,
      });

      await expect(requireAuth()).resolves.toMatchObject({ role });
    },
  );

  it("should read the status of the partner in the same query as the profile, not in one more", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: partnerRow({ status: "active" }), error: null });

    await requireAuth();

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("partner:partners(status)"));
  });
});

describe("requirePartnerScope (VI-F03-S05)", () => {
  beforeEach(resetMocks);

  const row = (role: "partner_user" | "admin", partner_id: string | null) => ({
    ...ACTIVE_ROW,
    role,
    partner_id,
    partner: partner_id ? { status: "active" } : null,
  });

  it("should return the user with the partner on their own profile", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: row("partner_user", "partner-a"), error: null });

    const user = await requirePartnerScope("bookings:view_own_partner");

    expect(user.partner_id).toBe("partner-a");
  });

  it("should send an admin with no partner to the no-partner page: the portal is per partner", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: row("admin", null), error: null });

    await expect(requirePartnerScope("bookings:view_own_partner")).rejects.toThrow(
      "REDIRECT:/forbidden?reason=no_partner",
    );
  });

  it("should send a user without the permission to /forbidden", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: ACTIVE_ROW, error: null });

    await expect(requirePartnerScope("seats:view_own_partner")).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
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

    expect(user).toEqual(ACTIVE_USER);
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

    expect(user).toEqual(ACTIVE_USER);
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

describe("requireAnyPermission", () => {
  beforeEach(resetMocks);

  const BOOKING_PERMISSIONS = [
    "bookings:manage",
    "bookings:view_own_partner",
  ] as const;

  it("should redirect to /login when there is no session", async () => {
    getAuthUserMock.mockResolvedValue(null);

    await expect(requireAnyPermission(BOOKING_PERMISSIONS)).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("should return the user when their role holds only one of the listed permissions", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: {
        ...ACTIVE_ROW,
        role: "partner_user",
        partner_id: "partner-a",
        partner: { status: "active" },
      },
      error: null,
    });

    const user = await requireAnyPermission(BOOKING_PERMISSIONS);

    expect(user.role).toBe("partner_user");
  });

  it("should redirect to /forbidden when the role holds none of the listed permissions", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({ data: ACTIVE_ROW, error: null });

    await expect(requireAnyPermission(BOOKING_PERMISSIONS)).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });

  it("should redirect to /forbidden when the permission list is empty", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, role: "admin" },
      error: null,
    });

    await expect(requireAnyPermission([])).rejects.toThrow(
      "REDIRECT:/forbidden",
    );
  });

  it("should let admin through without an explicit grant", async () => {
    getAuthUserMock.mockResolvedValue(AUTH_USER);
    singleMock.mockResolvedValue({
      data: { ...ACTIVE_ROW, role: "admin" },
      error: null,
    });

    const user = await requireAnyPermission(BOOKING_PERMISSIONS);

    expect(user.role).toBe("admin");
  });
});
