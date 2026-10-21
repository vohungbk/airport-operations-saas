import {
  NETWORK_ERROR,
  type BookingActionResult,
} from "@/features/bookings/lib/booking-errors";

/**
 * Next signals `redirect()` / `notFound()` by throwing an error whose digest
 * starts with `NEXT_`. It must reach the framework untouched.
 */
function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;

  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/**
 * Runs a booking Server Action from a client form. A failed call (network
 * down, server unreachable) becomes a `NETWORK_ERROR` result instead of a
 * thrown error, so the form stays on screen with the user's input and can
 * retry; it is never taken as a success. Redirects and other Next signals are
 * re-thrown, so a redirect to the forbidden page still happens.
 */
export async function runBookingAction(
  action: () => Promise<BookingActionResult>,
): Promise<BookingActionResult> {
  try {
    return await action();
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    return { success: false, error: NETWORK_ERROR };
  }
}
