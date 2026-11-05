import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const limitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/supabase/server", () => {
  const query = {
    select: () => query,
    not: () => query,
    order: () => query,
    limit: limitMock,
  };

  return { createClient: async () => ({ from: () => query }) };
});

import FlightProviderPage from "@/app/(admin)/settings/flight-provider/page";

/** VI-F02-S10 (spec R14): what the page hands to the browser holds no credential. */
describe("FlightProviderPage credentials", () => {
  const canary = "canary-0123456789-abcdef";

  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ role: "admin" });
    limitMock.mockReset();
    limitMock.mockResolvedValue({ data: [{ last_synced_at: "2026-12-01T10:00:00Z" }], error: null });
    vi.stubEnv("FLIGHT_SOURCE", "provider");
    vi.stubEnv("FLIGHT_PROVIDER_BASE_URL", "https://provider.internal.example");
    vi.stubEnv("FLIGHT_PROVIDER_API_KEY", canary);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should show the live provider as the source without the key or the address", async () => {
    const page = JSON.stringify(await FlightProviderPage());

    expect(page).toContain("provider");
    expect(page).not.toContain(canary);
    expect(page).not.toContain("provider.internal.example");
  });

  it("should not read the status for a role other than admin", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(FlightProviderPage()).rejects.toThrow("FORBIDDEN");
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("should name the variable and never the key when the configuration is wrong", async () => {
    vi.stubEnv("FLIGHT_PROVIDER_BASE_URL", "not a url");

    const error = await FlightProviderPage().catch((caught: Error) => caught);

    expect((error as Error).message).toContain("FLIGHT_PROVIDER_BASE_URL");
    expect((error as Error).message).not.toContain(canary);
  });
});
