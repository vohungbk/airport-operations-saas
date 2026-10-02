import {
  AIRPORT_NOT_FOUND_ERROR,
  VALIDATION_ERROR,
  type BookingActionError,
} from "@/features/bookings/lib/booking-errors";
import { zonedLocalToUtcIso } from "@/features/bookings/lib/booking-time";
import type {
  CreateBookingInput,
  UpdateBookingInput,
} from "@/features/bookings/schemas/booking.schema";

/** Blank optional text becomes `undefined` so the RPC default (NULL) applies. */
function textOrUndefined(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

function heightOrUndefined(value: string | undefined): number | undefined {
  return value ? Number(value) : undefined;
}

type SharedInput = CreateBookingInput | UpdateBookingInput;

function toSharedRpcArgs(input: SharedInput) {
  return {
    p_assigned_seat_id: textOrUndefined(input.assigned_seat_id),
    p_external_booking_number: textOrUndefined(input.external_booking_number),
    p_child_age_band: textOrUndefined(input.child_age_band),
    p_child_height: heightOrUndefined(input.child_height),
    p_vehicle: textOrUndefined(input.vehicle),
    p_vehicle_bay: textOrUndefined(input.vehicle_bay),
    p_notes: textOrUndefined(input.notes),
  };
}

/** Wall-clock pickup/return at the airport -> UTC; `null` for an unknown timezone. */
function toUtcTimes(input: SharedInput, timeZone: string) {
  const pickupAt = zonedLocalToUtcIso(input.pickup_at, timeZone);
  const returnAt = zonedLocalToUtcIso(input.return_at, timeZone);

  return pickupAt && returnAt
    ? { p_pickup_at: pickupAt, p_return_at: returnAt }
    : null;
}

export function toCreateBookingRpcArgs(
  input: CreateBookingInput,
  timeZone: string,
) {
  const times = toUtcTimes(input, timeZone);

  if (!times) {
    return null;
  }

  return {
    p_partner_id: input.partner_id,
    p_airport_id: input.airport_id,
    p_seat_category_id: input.seat_category_id,
    ...times,
    p_daily_rate: Number(input.daily_rate),
    ...toSharedRpcArgs(input),
  };
}

export function toUpdateBookingRpcArgs(
  bookingId: string,
  input: UpdateBookingInput,
  timeZone: string,
) {
  const times = toUtcTimes(input, timeZone);

  if (!times) {
    return null;
  }

  return {
    p_booking_id: bookingId,
    p_expected_updated_at: input.expected_updated_at,
    ...times,
    ...toSharedRpcArgs(input),
  };
}

export type RpcArgsResult<T> =
  | { args: T; error?: undefined }
  | { args?: undefined; error: BookingActionError };

/**
 * Shared by the create/update actions: a missing airport timezone is
 * `NOT_FOUND`, an unconvertible time is a validation error.
 */
export function resolveRpcArgs<T>(
  timeZone: string | null | undefined,
  build: (timeZone: string) => T | null,
): RpcArgsResult<T> {
  if (!timeZone) {
    return { error: AIRPORT_NOT_FOUND_ERROR };
  }

  const args = build(timeZone);

  return args ? { args } : { error: VALIDATION_ERROR };
}
