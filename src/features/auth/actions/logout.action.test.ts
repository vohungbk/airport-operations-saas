import { beforeEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signOut: signOutMock },
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { logoutAction } from "@/features/auth/actions/logout.action";

describe("logoutAction", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });
  });

  it("should call Supabase signOut and redirect to /login", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
