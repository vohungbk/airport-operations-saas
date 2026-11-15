import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ApiErrorCode } from "@/lib/api/response";
import { isWebhookSignatureValid } from "@/features/bookings/lib/verify-webhook-signature";
import {
  bookingWebhookBodySchema,
  webhookConfigIdSchema,
} from "@/features/bookings/schemas/booking-webhook.schema";
import type { Database, Json } from "@/types/database.types";

const MAX_BODY_CHARS = 100_000;

export const WEBHOOK_MESSAGES = {
  UNAUTHORIZED: "A valid webhook id and signature are required.",
  NOT_JSON: "The body is not valid JSON.",
  TOO_LARGE: "The body is too large.",
  INVALID_FIELDS: "The body misses fields or has invalid fields.",
  RATE_LIMITED: "Too many calls. Try again later.",
  INTERNAL: "The booking could not be received. Please try again.",
} as const;

export type WebhookOutcome =
  | { ok: true; status: 200 | 201; data: { status: "created" | "duplicate"; booking_id: string } }
  | {
      ok: false;
      code: ApiErrorCode;
      message: string;
      details?: { field: string; issue: string }[];
    };

interface WebhookCall {
  config_id: string | null;
  signature: string | null;
  raw_body: string;
}

type Client = SupabaseClient<Database>;

/** The log must never decide the answer: a failing log is dropped. */
async function logCall(client: Client, config_id: string | null, result: string, external: string | null, error: string) {
  try {
    await client.rpc("log_booking_webhook_call", {
      p_config_id: config_id as string,
      p_result: result,
      p_external_booking_number: external as string,
      p_error: error,
    });
  } catch {
    // Nothing to do: the caller still gets the answer of the call.
  }
}

function externalNumberOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).external_booking_number;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : null;
}

/**
 * CO-F07-S08, S09, S10 (R11, R12, R13, E6, E7): one webhook call, from the signature to the booking. The
 * signature is checked before the body is read, so an unsigned call creates nothing and learns nothing about the
 * setup. Every call is logged. The client is the service-role one: no user signs in for a webhook.
 */
export async function receiveBookingWebhook(client: Client, call: WebhookCall): Promise<WebhookOutcome> {
  const config = webhookConfigIdSchema.safeParse(call.config_id);
  const secret = config.success
    ? (await client.rpc("get_booking_webhook_secret", { p_config_id: config.data })).data
    : null;

  if (!config.success || !secret || !isWebhookSignatureValid(call.raw_body, call.signature, secret)) {
    await logCall(client, config.success ? config.data : null, "invalid_signature", null, "Signature or secret is missing or wrong");
    return { ok: false, code: "UNAUTHORIZED", message: WEBHOOK_MESSAGES.UNAUTHORIZED };
  }

  let body: unknown;
  try {
    if (call.raw_body.length > MAX_BODY_CHARS) throw new Error("too large");
    body = JSON.parse(call.raw_body);
  } catch {
    const too_large = call.raw_body.length > MAX_BODY_CHARS;
    const message = too_large ? WEBHOOK_MESSAGES.TOO_LARGE : WEBHOOK_MESSAGES.NOT_JSON;
    await logCall(client, config.data, "invalid_body", null, message);
    return { ok: false, code: "VALIDATION_ERROR", message };
  }

  const parsed = bookingWebhookBodySchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", issue: issue.message }));
    await logCall(
      client,
      config.data,
      "invalid_body",
      externalNumberOf(body),
      `Invalid: ${details.map((d) => d.field).join(", ")}`,
    );
    return { ok: false, code: "VALIDATION_ERROR", message: WEBHOOK_MESSAGES.INVALID_FIELDS, details };
  }

  const { data, error } = await client.rpc("receive_webhook_booking", {
    p_config_id: config.data,
    p_body: parsed.data as unknown as Json,
  });
  const result = z
    .object({ status: z.enum(["created", "duplicate", "rejected", "rate_limited"]), booking_id: z.string().optional(), message: z.string().optional() })
    .safeParse(data);

  if (error || !result.success) {
    return { ok: false, code: "INTERNAL_ERROR", message: WEBHOOK_MESSAGES.INTERNAL };
  }

  const { status, booking_id, message } = result.data;

  if (status === "rate_limited") return { ok: false, code: "RATE_LIMITED", message: WEBHOOK_MESSAGES.RATE_LIMITED };
  if (status === "rejected") return { ok: false, code: "VALIDATION_ERROR", message: message ?? WEBHOOK_MESSAGES.INVALID_FIELDS };
  if (!booking_id) return { ok: false, code: "INTERNAL_ERROR", message: WEBHOOK_MESSAGES.INTERNAL };

  return { ok: true, status: status === "created" ? 201 : 200, data: { status, booking_id } };
}
