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

  it("should reject an answer that is not a flight", async () => {
    const { adapter } = adapterWith(Response.json({ flight_number: "VN123", status: "flying" }));

    await expect(adapter.fetchFlight("VN123")).rejects.toThrow();
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
