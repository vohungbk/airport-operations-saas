import { z } from "zod";

import { MANUAL_TARGET_STATUSES } from "@/features/seats/lib/seat-status";

const SEAT_MAX_RENTAL_CYCLES_LIMIT = 100_000;

// z.guid(), not z.uuid(): seeded dev ids (e.g. e0000000-0000-0000-0000-...)
// are not RFC-variant UUIDs and z.uuid() would reject them.
const idSchema = z.guid();

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be at most ${max} characters.`);

/** Calendar-valid `YYYY-MM-DD` (rejects e.g. 2026-02-31). */
function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
}

const dateField = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date.`)
    .refine(isCalendarDate, `${label} must be a valid date.`);

const maxRentalCyclesField = (min: number) =>
  z
    .number({ error: "Max rental cycles is required." })
    .int("Max rental cycles must be a whole number.")
    .min(
      Math.max(1, min),
      min > 1
        ? `Max rental cycles cannot be lower than the current rental cycles (${min}).`
        : "Max rental cycles must be at least 1.",
    )
    .max(
      SEAT_MAX_RENTAL_CYCLES_LIMIT,
      `Max rental cycles must be at most ${SEAT_MAX_RENTAL_CYCLES_LIMIT}.`,
    );

const sharedSeatFields = {
  manufacturer: requiredText("Manufacturer", 100),
  model: requiredText("Model", 100),
  manufacture_date: dateField("Manufacture date"),
  purchase_date: dateField("Purchase date"),
  category_id: z.guid("Category is required."),
  airport_id: z.guid("Airport is required."),
};

/**
 * No `public_token`, `status` or `rental_cycles`: the DB generates the
 * token and defaults the others, so a client can never set them.
 */
export const createSeatSchema = z.object({
  serial_number: requiredText("Serial number", 100),
  ...sharedSeatFields,
  max_rental_cycles: maxRentalCyclesField(1),
});

export type CreateSeatInput = z.infer<typeof createSeatSchema>;

/**
 * `min` is the seat's current `rental_cycles`: the cap can never drop
 * below cycles already used. `serial_number` is immutable after create,
 * so it is not part of this schema.
 */
export function buildUpdateSeatSchema(currentRentalCycles = 0) {
  return z.object({
    ...sharedSeatFields,
    max_rental_cycles: maxRentalCyclesField(currentRentalCycles),
  });
}

export type UpdateSeatInput = z.infer<ReturnType<typeof buildUpdateSeatSchema>>;

export const seatIdSchema = idSchema;

/** Manual targets only; operational statuses are never user-selectable. */
export const changeSeatStatusSchema = z
  .object({
    seat_id: idSchema,
    to_status: z.enum(MANUAL_TARGET_STATUSES),
    reason: z
      .string()
      .trim()
      .max(500, "Reason must be at most 500 characters.")
      .nullish()
      .transform((value) => (value ? value : null)),
  })
  .refine((value) => value.to_status !== "quarantine" || value.reason !== null, {
    message: "A reason is required to quarantine a seat.",
    path: ["reason"],
  });

export type ChangeSeatStatusInput = z.infer<typeof changeSeatStatusSchema>;
