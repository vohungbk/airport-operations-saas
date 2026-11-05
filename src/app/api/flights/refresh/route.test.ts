import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshFlightsMock = vi.hoisted(() => vi.fn());
const createServiceRoleClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/flights/lib/refresh-flights", () => ({ refreshFlights: refreshFlightsMock }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: createServiceRoleClientMock }));

import { POST } from "@/app/api/flights/refresh/route";

const SUMMARY = { checked: 3, refreshed: 2, changed: 1, skipped: 0, not_found: 0, failed: 1 };

const call = (authorization?: string) =>
  POST(
    new Request("http://localhost/api/flights/refresh", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }) as never,
  );

describe("POST /api/flights/refresh (VI-F02-S03)", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "scheduler-token-1");
    refreshFlightsMock.mockReset();
    refreshFlightsMock.mockResolvedValue(SUMMARY);
    createServiceRoleClientMock.mockReset();
    createServiceRoleClientMock.mockReturnValue({});
  });

  it("should refresh the flights and answer the summary when the secret is right", async () => {
    const response = await call("Bearer scheduler-token-1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: SUMMARY });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(refreshFlightsMock).toHaveBeenCalledTimes(1);
  });

  it("should return 401 and refresh nothing when the secret is wrong", async () => {
    const response = await call("Bearer wrong");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(refreshFlightsMock).not.toHaveBeenCalled();
    expect(createServiceRoleClientMock).not.toHaveBeenCalled();
  });

  it("should return 401 when there is no Authorization header", async () => {
    const response = await call();

    expect(response.status).toBe(401);
    expect(refreshFlightsMock).not.toHaveBeenCalled();
  });

  it("should answer like a wrong secret and refresh nothing when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await call("Bearer anything");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(refreshFlightsMock).not.toHaveBeenCalled();
  });

  it("should return 500 without the error text when the refresh fails", async () => {
    refreshFlightsMock.mockRejectedValue(new Error("password authentication failed for user postgres"));

    const response = await call("Bearer scheduler-token-1");
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).toContain("INTERNAL_ERROR");
    expect(text).not.toContain("password");
  });
});
