import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaimsMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getClaims: getClaimsMock },
  })),
}));

import { updateSession } from "@/lib/supabase/proxy";

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

describe("updateSession", () => {
  beforeEach(() => {
    getClaimsMock.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  });

  it("should redirect an unauthenticated request on a protected route to /login", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(makeRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("should redirect an authenticated request on /login to /dashboard", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
    });

    const response = await updateSession(makeRequest("/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard",
    );
  });

  it("should redirect an authenticated request on /signup to /dashboard", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
    });

    const response = await updateSession(makeRequest("/signup"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard",
    );
  });

  it("should pass an unauthenticated request through untouched for a public route", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(makeRequest("/login"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("should pass an authenticated request through untouched for a protected, non-auth-only route", async () => {
    getClaimsMock.mockResolvedValue({
      data: { claims: { sub: "user-1" } },
    });

    const response = await updateSession(makeRequest("/dashboard"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("should pass an unauthenticated request through untouched for the root public route", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null } });

    const response = await updateSession(makeRequest("/"));

    expect(response.headers.get("location")).toBeNull();
  });
});
