"use client";

import { useEffect, useState } from "react";

import {
  getAvailableSeatsAction,
  type AvailableSeat,
} from "@/features/bookings/actions/get-available-seats.action";
import { isLocalDateTime } from "@/features/bookings/lib/booking-time";

const SEAT_LOOKUP_DEBOUNCE_MS = 300;

interface UseAvailableSeatsArgs {
  airportId: string;
  seatCategoryId: string;
  pickupAt: string;
  returnAt: string;
  excludeBookingId?: string;
}

interface AvailableSeatsState {
  key: string;
  seats: AvailableSeat[];
  failed: boolean;
}

/**
 * Loads the seats a booking could use for the chosen airport, category and
 * period. Idle until all four inputs are valid. The result is tagged with
 * the inputs it was loaded for, so stale or in-flight state is never
 * shown for different inputs. The database re-validates on submit.
 */
export function useAvailableSeats({
  airportId,
  seatCategoryId,
  pickupAt,
  returnAt,
  excludeBookingId,
}: UseAvailableSeatsArgs) {
  const [state, setState] = useState<AvailableSeatsState | null>(null);

  const isReady =
    !!airportId &&
    !!seatCategoryId &&
    isLocalDateTime(pickupAt) &&
    isLocalDateTime(returnAt) &&
    returnAt >= pickupAt;
  const key = isReady
    ? [airportId, seatCategoryId, pickupAt, returnAt, excludeBookingId].join("|")
    : "";

  useEffect(() => {
    if (!key) return;

    let cancelled = false;
    // Debounced so typing a date does not fire a request per keystroke.
    const timer = setTimeout(() => {
      getAvailableSeatsAction({
        airport_id: airportId,
        seat_category_id: seatCategoryId,
        pickup_at: pickupAt,
        return_at: returnAt,
        exclude_booking_id: excludeBookingId,
      }).then((result) => {
        if (cancelled) return;
        setState({
          key,
          seats: result.success ? (result.seats ?? []) : [],
          failed: !result.success,
        });
      });
    }, SEAT_LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, airportId, seatCategoryId, pickupAt, returnAt, excludeBookingId]);

  const current = state && state.key === key ? state : null;

  return {
    isReady,
    isLoading: isReady && current === null,
    seats: current?.seats ?? [],
    failed: current?.failed ?? false,
  };
}
