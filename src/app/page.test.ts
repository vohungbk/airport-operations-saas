import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import Home from "@/app/page";

function userWithRole(role: string) {
  return {
    id: "user-1",
    email: "user@example.com",
    full_name: "User",
    role,
    partner_id: null,
    is_active: true,
  };
}

describe("Home", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    redirectMock.mockClear();
  });

  it("should redirect an admin to the dashboard", async () => {
    requireAuthMock.mockResolvedValue(userWithRole("admin"));

    await expect(Home()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("should redirect a technician to the technician home", async () => {
    requireAuthMock.mockResolvedValue(userWithRole("technician"));

    await expect(Home()).rejects.toThrow("REDIRECT:/technician");
  });

  it("should redirect a partner user to the partner home", async () => {
    requireAuthMock.mockResolvedValue(userWithRole("partner_user"));

    await expect(Home()).rejects.toThrow("REDIRECT:/partner");
  });

  it("should propagate the redirect of requireAuth when there is no session", async () => {
    requireAuthMock.mockRejectedValue(new Error("REDIRECT:/login"));

    await expect(Home()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
