import { z } from "zod";

/** Letters and digits as printed on a ticket, for example `VN123` (matches the database check). */
export const FLIGHT_NUMBER_PATTERN = /^[A-Z0-9]{2,8}$/;

/** `vn 123` becomes `VN123`: spaces are dropped and the letters are upper case. Idempotent. */
export function normalizeFlightNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/**
 * VI-F02-S01: the flight number of a booking form. Empty means the booking has no flight. The
 * output is the normalized text, so the Server Action can parse the same input again.
 */
export const flightNumberField = z
  .string()
  .transform(normalizeFlightNumber)
  .refine(
    (value) => value === "" || FLIGHT_NUMBER_PATTERN.test(value),
    "Flight number must be 2 to 8 letters or digits.",
  )
  .optional();
