import { beforeEach, describe, expect, it, vi } from "vitest";

import { receiveBookingWebhook } from "@/features/bookings/lib/receive-booking-webhook";
import { signWebhookBody } from "@/features/bookings/lib/verify-webhook-signature";

const SECRET = "a-secret-of-at-least-32-characters-long";
const CONFIG_ID = "d5300000-0000-0000-0000-000000000001";
const BOOKING_ID = "d5100000-0000-0000-0000-000000000001";
const BODY = JSON.stringify({
  external_booking_number: "EXT-1",
  seat_category_id: "c0000000-0000-0000-0000-000000000001",
  pickup_at: "2030-01-01T10:00:00Z",
  return_at: "2030-01-04T10:00:00Z",
  daily_rate: 90,
});

const rpc = vi.fn();
const client = { rpc } as never;

/** The answer of the receive function; the secret lookup answers the secret; the log answers nothing. */
function answer(receive: unknown, secret: string | null = SECRET) {
  rpc.mockImplementation(async (name: string) => {
    if (name === "get_booking_webhook_secret") return { data: secret, error: null };
    if (name === "receive_webhook_booking") return { data: receive, error: null };
    return { data: null, error: null };
  });
}

const signed = (raw_body = BODY) => ({ config_id: CONFIG_ID, signature: signWebhookBody(raw_body, SECRET), raw_body });
const names = () => rpc.mock.calls.map(([name]) => name);
const logged = () => rpc.mock.calls.filter(([name]) => name === "log_booking_webhook_call").map(([, args]) => args.p_result);

describe("receiveBookingWebhook (CO-F07-S08, S09, S10)", () => {
  beforeEach(() => {
    rpc.mockReset();
    answer({ status: "created", booking_id: BOOKING_ID });
  });

  it("should create the booking and answer 201 when the signature is valid (R11)", async () => {
    expect(await receiveBookingWebhook(client, signed())).toEqual({
      ok: true,
      status: 201,
      data: { status: "created", booking_id: BOOKING_ID },
    });
  });

  it.each([
    ["the signature is missing", { ...signed(), signature: null }, SECRET],
    ["the signature is wrong", { ...signed(), signature: signWebhookBody(BODY, "another-secret-of-at-least-32-chars!") }, SECRET],
    ["the id is not an id", { ...signed(), config_id: "nope" }, SECRET],
    ["the id is unknown", signed(), null],
  ])("should answer 401, log it and create nothing when %s (R12)", async (_name, call, secret) => {
    answer({ status: "created", booking_id: BOOKING_ID }, secret);

    const outcome = await receiveBookingWebhook(client, call);

    expect(outcome).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(names()).not.toContain("receive_webhook_booking");
    expect(logged()).toEqual(["invalid_signature"]);
  });

  it("should reject a body that is not valid JSON with a clear message and log it (E7)", async () => {
    const outcome = await receiveBookingWebhook(client, signed("{not json"));

    expect(outcome).toMatchObject({ ok: false, code: "VALIDATION_ERROR", message: "The body is not valid JSON." });
    expect(logged()).toEqual(["invalid_body"]);
    expect(names()).not.toContain("receive_webhook_booking");
  });

  it("should reject a body that misses fields, name the fields and log it (E7)", async () => {
    const outcome = await receiveBookingWebhook(client, signed(JSON.stringify({ external_booking_number: "EXT-1" })));

    expect(outcome).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(outcome.ok === false && outcome.details?.map((d) => d.field)).toContain("seat_category_id");
    expect(logged()).toEqual(["invalid_body"]);
  });

  it("should answer 200 with the first booking when the external booking number came before (R13)", async () => {
    answer({ status: "duplicate", booking_id: BOOKING_ID });

    expect(await receiveBookingWebhook(client, signed())).toEqual({
      ok: true,
      status: 200,
      data: { status: "duplicate", booking_id: BOOKING_ID },
    });
  });

  it("should answer RATE_LIMITED when the calls are limited (E6)", async () => {
    answer({ status: "rate_limited" });

    expect(await receiveBookingWebhook(client, signed())).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });

  it("should answer the message of the function when the booking is rejected", async () => {
    answer({ status: "rejected", message: "Seat category must exist and be active" });

    expect(await receiveBookingWebhook(client, signed())).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Seat category must exist and be active",
    });
  });

  it("should answer INTERNAL_ERROR without database text when the function fails", async () => {
    rpc.mockImplementation(async (name: string) =>
      name === "get_booking_webhook_secret"
        ? { data: SECRET, error: null }
        : { data: null, error: { message: "relation x does not exist" } },
    );

    expect(await receiveBookingWebhook(client, signed())).toEqual({
      ok: false,
      code: "INTERNAL_ERROR",
      message: "The booking could not be received. Please try again.",
    });
  });
});
