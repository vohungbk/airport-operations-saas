import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ getAuthUser: getAuthUserMock }));
vi.mock("@/features/auth/components/logout-button", () => ({
  LogoutButton: () => "LOGOUT",
}));

import ForbiddenPage from "@/app/forbidden/page";

async function render(reason?: string) {
  return renderToStaticMarkup(
    await ForbiddenPage({ searchParams: Promise.resolve({ reason }) }),
  );
}

describe("ForbiddenPage", () => {
  beforeEach(() => {
    getAuthUserMock.mockReset();
    getAuthUserMock.mockResolvedValue({ id: "u-1", email: "u@example.com" });
  });

  it("should say what is missing for a partner user with no partner, and offer to sign out", async () => {
    const html = await render("no_partner");

    expect(html).toContain("Access denied");
    expect(html).toContain("not linked to a partner yet");
    expect(html).toContain("LOGOUT");
  });

  it("should keep the generic copy, which confirms nothing, when there is no reason", async () => {
    const html = await render();

    expect(html).toContain("You don&#x27;t have permission to view this page");
    expect(html).not.toContain("not linked to a partner");
  });

  it("should ignore a reason it does not know, so the address cannot inject text", async () => {
    const html = await render("<script>alert(1)</script>");

    expect(html).not.toContain("script");
    expect(html).not.toContain("not linked to a partner");
  });

  it("should still describe the setup failure for confirm_profile_failed", async () => {
    expect(await render("confirm_profile_failed")).toContain("Account setup incomplete");
  });

  it("should offer sign in instead of sign out when nobody is signed in", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const html = await render("no_partner");

    expect(html).toContain("Sign in");
    expect(html).not.toContain("LOGOUT");
  });
});
