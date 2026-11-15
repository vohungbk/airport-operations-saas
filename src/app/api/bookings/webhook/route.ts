import { type NextRequest, NextResponse } from "next/server";

import { apiError } from "@/lib/api/response";
import { WEBHOOK_MESSAGES, receiveBookingWebhook } from "@/features/bookings/lib/receive-booking-webhook";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** The seconds an external system is told to wait after it is limited (E6). */
const RETRY_AFTER_SECONDS = "60";

/**
 * CO-F07-S08, S09, S10: an external system sends a booking as JSON, signed with the shared secret of its partner
 * (`X-Webhook-Id` and `X-Webhook-Signature: sha256=<hmac of the raw body>`). Nobody signs in for it, so the
 * signature is the access check; the business rules are in `receiveBookingWebhook`. The answer to a failure is
 * the standardized error shape; no database text is returned.
 */
export async function POST(request: NextRequest) {
  try {
    const outcome = await receiveBookingWebhook(createServiceRoleClient(), {
      config_id: request.headers.get("x-webhook-id"),
      signature: request.headers.get("x-webhook-signature"),
      raw_body: await request.text(),
    });

    if (outcome.ok) {
      return NextResponse.json({ data: outcome.data }, { status: outcome.status, headers: { "Cache-Control": "no-store" } });
    }

    const response = apiError(outcome.code, outcome.message, outcome.details);
    if (outcome.code === "RATE_LIMITED") response.headers.set("Retry-After", RETRY_AFTER_SECONDS);
    return response;
  } catch {
    return apiError("INTERNAL_ERROR", WEBHOOK_MESSAGES.INTERNAL);
  }
}
