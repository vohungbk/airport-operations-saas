import { beforeEach, describe, expect, it, vi } from "vitest";

const receiveMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/bookings/lib/receive-booking-webhook", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/bookings/lib/receive-booking-webhook")>()),
  receiveBookingWebhook: receiveMock,
}));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({}) }));

import { POST } from "@/app/api/bookings/webhook/route";

const call = () =>
  POST(
    new Request("http://localhost/api/bookings/webhook", {
      method: "POST",
      headers: { "x-webhook-id": "id-1", "x-webhook-signature": "sha256=abc" },
      body: '{"a":1}',
    }) as never,
  );

describe("POST /api/bookings/webhook (CO-F07-S08, S09, S10)", () => {
  beforeEach(() => {
    receiveMock.mockReset();
  });

  it("should pass the headers and the raw body on and answer 201 with the booking", async () => {
    receiveMock.mockResolvedValue({ ok: true, status: 201, data: { status: "created", booking_id: "b1" } });

    const response = await call();

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { status: "created", booking_id: "b1" } });
    expect(receiveMock).toHaveBeenCalledWith({}, { config_id: "id-1", signature: "sha256=abc", raw_body: '{"a":1}' });
  });

  it("should answer 401 in the standardized error shape when the call is not authorized", async () => {
    receiveMock.mockResolvedValue({ ok: false, code: "UNAUTHORIZED", message: "A valid webhook id and signature are required." });

    const response = await call();

    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("should answer 429 with a Retry-After header when the calls are limited", async () => {
    receiveMock.mockResolvedValue({ ok: false, code: "RATE_LIMITED", message: "Too many calls. Try again later." });

    const response = await call();

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("should answer 500 without the error text when something throws", async () => {
    receiveMock.mockRejectedValue(new Error("db password leaked"));

    const response = await call();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("leaked");
  });
});
