import { describe, expect, it, vi } from "vitest";

import { createProviderAdapter } from "./provider-adapter";

const FLIGHT = {
  flight_number: "VN123",
  status: "scheduled",
  scheduled_arrival_at: "2026-12-01T10:00:00Z",
  estimated_arrival_at: null,
  actual_arrival_at: null,
  terminal: null,
  delay_minutes: null,
};

function adapterWith(response: Response) {
  const fetchImpl = vi.fn().mockResolvedValue(response);
  const adapter = createProviderAdapter({
    base_url: "https://api.example.com/",
    provider_key: "secret-key",
    fetchImpl,
  });

  return { adapter, fetchImpl };
}

describe("createProviderAdapter", () => {
  it("should call the provider with the bearer key and return the parsed flight", async () => {
    const { adapter, fetchImpl } = adapterWith(Response.json(FLIGHT));

    const flight = await adapter.fetchFlight("VN123");

    expect(flight).toEqual(FLIGHT);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/flights/VN123",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer secret-key" }) }),
    );
  });

  it("should return null when the provider does not know the flight", async () => {
    const { adapter } = adapterWith(new Response(null, { status: 404 }));

    expect(await adapter.fetchFlight("XX000")).toBeNull();
  });

  it("should throw without the key in the message when the provider fails", async () => {
    const { adapter } = adapterWith(new Response(null, { status: 503 }));

    const error = await adapter.fetchFlight("VN123").catch((caught: Error) => caught);

    expect((error as Error).message).toBe("Flight provider answered with status 503");
  });

  it("should reject an answer that is not a flight as an invalid response", async () => {
    const { adapter } = adapterWith(Response.json({ flight_number: "VN123", status: "flying" }));

    await expect(adapter.fetchFlight("VN123")).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("should reject an answer that is not JSON as an invalid response", async () => {
    const { adapter } = adapterWith(new Response("<html>", { status: 200 }));

    await expect(adapter.fetchFlight("VN123")).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("should raise a timeout error when the timeout hits while the body is read", async () => {
    const response = { status: 200, ok: true, json: () => Promise.reject(new DOMException("timed out", "TimeoutError")) };
    const adapter = createProviderAdapter({
      base_url: "https://api.example.com",
      provider_key: "k",
      fetchImpl: vi.fn().mockResolvedValue(response),
    });

    await expect(adapter.fetchFlight("VN123")).rejects.toMatchObject({ kind: "timeout" });
  });

  it("should raise a rate limited error when the provider answers 429 (VI-F02-S11-AC01)", async () => {
    const { adapter } = adapterWith(new Response(null, { status: 429 }));

    await expect(adapter.fetchFlight("VN123")).rejects.toMatchObject({ kind: "rate_limited" });
  });

  it("should raise an unavailable error when the provider answers 503 (VI-F02-S11-AC01)", async () => {
    const { adapter } = adapterWith(new Response(null, { status: 503 }));

    await expect(adapter.fetchFlight("VN123")).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("should raise a timeout error when the provider does not answer in time (VI-F02-S11-AC01)", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const adapter = createProviderAdapter({ base_url: "https://api.example.com", provider_key: "k", fetchImpl });

    await expect(adapter.fetchFlight("VN123")).rejects.toMatchObject({ kind: "timeout" });
  });

  it("should raise an unavailable error when the connection fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const adapter = createProviderAdapter({ base_url: "https://api.example.com", provider_key: "k", fetchImpl });

    await expect(adapter.fetchFlight("VN123")).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("should send the key only in the Authorization header, never in the address or elsewhere", async () => {
    const { adapter, fetchImpl } = adapterWith(Response.json(FLIGHT));

    await adapter.fetchFlight("VN123");

    const [url, init] = fetchImpl.mock.calls[0];
    const { headers, ...rest } = init;

    expect(url).not.toContain("secret-key");
    expect(JSON.stringify(rest)).not.toContain("secret-key");
    expect(Object.entries(headers).filter(([, value]) => String(value).includes("secret-key"))).toEqual([
      ["Authorization", "Bearer secret-key"],
    ]);
  });

  it.each([
    ["the connection fails", new TypeError("fetch failed")],
    ["the provider times out", new DOMException("The operation timed out", "TimeoutError")],
  ])("should not carry the key in the error when %s", async (_case, failure) => {
    const fetchImpl = vi.fn().mockRejectedValue(failure);
    const adapter = createProviderAdapter({
      base_url: "https://api.example.com",
      provider_key: "secret-key",
      fetchImpl,
    });

    const error = await adapter.fetchFlight("VN123").catch((caught: Error) => caught);

    expect(String((error as Error).message)).not.toContain("secret-key");
    expect(JSON.stringify((error as Error).cause ?? null)).not.toContain("secret-key");
  });

  it("should not carry the key in the error when the answer is not a flight", async () => {
    const { adapter } = adapterWith(Response.json({ flight_number: "VN123", status: "flying" }));

    const error = await adapter.fetchFlight("VN123").catch((caught: Error) => caught);

    expect((error as Error).message).not.toContain("secret-key");
  });

  it("should encode the flight number in the address", async () => {
    const { adapter, fetchImpl } = adapterWith(new Response(null, { status: 404 }));

    await adapter.fetchFlight("A/B ?");

    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.example.com/flights/A%2FB%20%3F");
  });
});
