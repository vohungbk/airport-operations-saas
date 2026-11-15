import { z } from "zod";

import { DAILY_RATE_MAX } from "@/features/bookings/schemas/booking.schema";

// z.guid(), not z.uuid(): seeded dev ids are not RFC-variant UUIDs (see booking.schema.ts).
/** CO-F07-S08: the id of the webhook configuration that the sender puts in the `X-Webhook-Id` header. */
export const webhookConfigIdSchema = z.guid();

/** A time with a zone (`2030-01-01T10:00:00Z`): the sender is a system, so no wall-clock time is guessed. */
const timeField = z.iso.datetime({ offset: true });

const optionalText = (max: number) => z.string().trim().max(max).optional();

/**
 * CO-F07-S08 (R11, E7): the JSON body of a webhook call. The same limits as manual entry; the partner and
 * the airport are not in the body, the configuration of the secret decides them (R15). The external booking
 * number is required, because it is what makes a retry safe (R13).
 */
export const bookingWebhookBodySchema = z
  .object({
    external_booking_number: z.string().trim().min(1).max(100),
    seat_category_id: z.guid(),
    pickup_at: timeField,
    return_at: timeField,
    daily_rate: z
      .number()
      .gt(0)
      .max(DAILY_RATE_MAX)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
        message: "Must have at most 2 decimals.",
      }),
    child_age_band: optionalText(50),
    vehicle: optionalText(100),
    notes: optionalText(2000),
  })
  .refine((value) => Date.parse(value.return_at) >= Date.parse(value.pickup_at), {
    message: "Return must not be before pickup.",
    path: ["return_at"],
  });
