import { z } from "zod";

import {
  MANUAL_TARGET_STATUSES,
  isReasonRequired,
} from "@/features/bookings/lib/booking-status";
import { isLocalDateTime } from "@/features/bookings/lib/booking-time";

// z.guid(), not z.uuid(): seeded dev ids (e.g. f0000000-0000-0000-0000-...)
// are not RFC-variant UUIDs and z.uuid() would reject them.
export const bookingIdSchema = z.guid();

const DAILY_RATE_MAX = 1_000_000;
const CHILD_HEIGHT_MAX = 250;

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters.`)
    .optional();

const localDateTimeField = (label: string) =>
  z
    .string()
    .trim()
    .refine(isLocalDateTime, `${label} must be a valid date and time.`);

/**
 * Numbers stay strings in the form layer (an empty `<input type=number>`
 * is `""`); `toRpcArgs` converts them once validated. Keeping the schema
 * output equal to the form values also keeps every transform idempotent
 * when the Server Action re-parses the same input.
 */
const dailyRateField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Daily rate must be a number with up to 2 decimals.")
  .refine(
    (value) => Number(value) <= DAILY_RATE_MAX,
    `Daily rate must be at most ${DAILY_RATE_MAX}.`,
  );

const childHeightField = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      (/^\d+(\.\d)?$/.test(value) &&
        Number(value) > 0 &&
        Number(value) <= CHILD_HEIGHT_MAX),
    `Child height must be a number up to ${CHILD_HEIGHT_MAX} with 1 decimal.`,
  )
  .optional();

const seatIdField = z
  .string()
  .trim()
  .refine((value) => value === "" || bookingIdSchema.safeParse(value).success, {
    message: "Select a valid seat.",
  })
  .optional();

const sharedBookingFields = {
  pickup_at: localDateTimeField("Pickup"),
  return_at: localDateTimeField("Return"),
  assigned_seat_id: seatIdField,
  external_booking_number: optionalText("External booking number", 100),
  child_age_band: optionalText("Child age band", 50),
  child_height: childHeightField,
  vehicle: optionalText("Vehicle", 100),
  vehicle_bay: optionalText("Vehicle bay", 50),
  notes: optionalText("Notes", 2000),
};

/** `YYYY-MM-DDTHH:mm` strings compare correctly as plain strings. */
function returnNotBeforePickup(value: { pickup_at: string; return_at: string }) {
  return value.return_at >= value.pickup_at;
}

const RETURN_BEFORE_PICKUP_ISSUE = {
  message: "Return must not be before pickup.",
  path: ["return_at"],
};

/**
 * No `status`, `booking_number`, finance, flight or technician fields:
 * the RPC sets status to `pending` and generates the number, so a client
 * can never set them.
 */
export const createBookingSchema = z
  .object({
    partner_id: z.guid("Partner is required."),
    airport_id: z.guid("Airport is required."),
    seat_category_id: z.guid("Seat category is required."),
    daily_rate: dailyRateField,
    ...sharedBookingFields,
  })
  .refine(returnNotBeforePickup, RETURN_BEFORE_PICKUP_ISSUE);

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/**
 * Partner, airport, category, status, number and `daily_rate` are
 * read-only after create, so they are not part of this schema.
 * `expected_updated_at` is the lost-update guard checked by the RPC.
 */
export const updateBookingSchema = z
  .object({
    expected_updated_at: z
      .string()
      .refine(
        (value) => !Number.isNaN(Date.parse(value)),
        "Reload the page and try again.",
      ),
    ...sharedBookingFields,
  })
  .refine(returnNotBeforePickup, RETURN_BEFORE_PICKUP_ISSUE);

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

/** Manual targets only; operational statuses are never user-selectable. */
export const changeBookingStatusSchema = z
  .object({
    booking_id: bookingIdSchema,
    to_status: z.enum(MANUAL_TARGET_STATUSES),
    reason: z
      .string()
      .trim()
      .max(500, "Reason must be at most 500 characters.")
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .refine((value) => !isReasonRequired(value.to_status) || value.reason !== null, {
    message: "A reason is required to cancel a booking or mark it as no-show.",
    path: ["reason"],
  });

export type ChangeBookingStatusInput = z.infer<
  typeof changeBookingStatusSchema
>;

export const availableSeatsQuerySchema = z.object({
  airport_id: bookingIdSchema,
  seat_category_id: bookingIdSchema,
  pickup_at: localDateTimeField("Pickup"),
  return_at: localDateTimeField("Return"),
  exclude_booking_id: bookingIdSchema.optional(),
});
