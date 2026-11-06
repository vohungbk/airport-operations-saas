import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => {
  const flights = {
    select: () => flights,
    not: () => flights,
    order: () => flights,
    limit: limitMock,
  };
  const errors = { select: () => errors, eq: () => errors, maybeSingle: errorMock };

  return { createClient: async () => ({ from: (table: string) => (table === "flights" ? flights : errors) }) };
});

import { getProviderStatus } from "@/features/flights/lib/get-provider-status";

describe("getProviderStatus", () => {
  beforeEach(() => {
    limitMock.mockReset();
    errorMock.mockReset();
    errorMock.mockResolvedValue({ data: null, error: null });
  });

  it("should return the active source and the last sync time", async () => {
    limitMock.mockResolvedValue({ data: [{ last_synced_at: "2026-12-01T10:00:00Z" }], error: null });

    expect(await getProviderStatus({ FLIGHT_SOURCE: "sandbox" })).toEqual({
      source: "sandbox",
      last_synced_at: "2026-12-01T10:00:00Z",
      last_error: null,
    });
  });

  it("should return the last error of the source as text (VI-F02-S11-AC01)", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });
    errorMock.mockResolvedValue({
      data: { last_error_kind: "timeout", last_error_at: "2026-12-01T10:05:00Z" },
      error: null,
    });

    expect((await getProviderStatus({})).last_error).toBe("Timed out · 2026-12-01 10:05 UTC");
  });

  it("should throw when the last error cannot be read", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });
    errorMock.mockResolvedValue({ data: null, error: new Error("db down") });

    await expect(getProviderStatus({})).rejects.toThrow("db down");
  });

  it("should return no last sync when no flight was ever refreshed", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    expect((await getProviderStatus({})).last_synced_at).toBeNull();
  });

  it("should throw when the database fails", async () => {
    limitMock.mockResolvedValue({ data: null, error: new Error("db down") });

    await expect(getProviderStatus({})).rejects.toThrow("db down");
  });

  it("should throw on an invalid configuration before it reads the database", async () => {
    await expect(getProviderStatus({ FLIGHT_SOURCE: "radar" })).rejects.toThrow(/FLIGHT_SOURCE/);
    expect(limitMock).not.toHaveBeenCalled();
  });

  it("should never include a credential in the status", async () => {
    limitMock.mockResolvedValue({ data: [], error: null });

    const status = await getProviderStatus({
      FLIGHT_SOURCE: "provider",
      FLIGHT_PROVIDER_BASE_URL: "https://api.example.com",
      FLIGHT_PROVIDER_API_KEY: "secret-key",
    });

    expect(JSON.stringify(status)).not.toContain("secret-key");
    expect(JSON.stringify(status)).not.toContain("api.example.com");
  });
});
