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

  describe("sign in and come back (FO-F03-S11, spec E11)", () => {
    const locationOf = async (path: string) => {
      getClaimsMock.mockResolvedValue({ data: { claims: null } });
      const response = await updateSession(makeRequest(path));
      return response.headers.get("location");
    };

    it("should send a person who is not signed in to /login with the page they asked for", async () => {
      expect(await locationOf("/seats/5e2a2c8e/cleaning")).toBe(
        "http://localhost:3000/login?next=%2Fseats%2F5e2a2c8e%2Fcleaning",
      );
    });

    it("should keep the query of the page they asked for", async () => {
      expect(await locationOf("/bookings?status=pending&page=2")).toBe(
        "http://localhost:3000/login?next=%2Fbookings%3Fstatus%3Dpending%26page%3D2",
      );
    });

    it("should send a scan of a seat QR code to sign in and bring the person back to it (FO-F03-S11, CO-F04-S13)", async () => {
      expect(await locationOf("/q/00000000-0000-4000-8000-0000000000a1")).toBe(
        "http://localhost:3000/login?next=%2Fq%2F00000000-0000-4000-8000-0000000000a1",
      );
    });

    it("should not add the dashboard, which is where every sign in goes anyway", async () => {
      expect(await locationOf("/dashboard")).toBe("http://localhost:3000/login");
    });

    it("should not give an api route as the page to return to", async () => {
      expect(await locationOf("/api/other")).toBe("http://localhost:3000/login");
    });

    it("should not perform anything for the request: it only redirects (AC03)", async () => {
      getClaimsMock.mockResolvedValue({ data: { claims: null } });

      const response = await updateSession(makeRequest("/seats/5e2a2c8e/cleaning"));

      expect(response.status).toBe(307);
      expect(getClaimsMock).toHaveBeenCalledTimes(1);
    });
  });

  it("should send a signed-in person on /login to the safe page they asked for, else the dashboard", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "u-1" } } });

    const back = await updateSession(makeRequest("/login?next=%2Fseats%2Fx%2Fcleaning"));
    const evil = await updateSession(makeRequest("/login?next=https%3A%2F%2Fevil.example"));

    expect(back.headers.get("location")).toBe("http://localhost:3000/seats/x/cleaning");
    expect(evil.headers.get("location")).toBe("http://localhost:3000/dashboard");
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

  it("should throw a configuration error when the Supabase URL is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";

    await expect(updateSession(makeRequest("/dashboard"))).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(getClaimsMock).not.toHaveBeenCalled();
  });
});
