import { z } from "zod";

import { isLocalDateTime } from "@/features/bookings/lib/booking-time";

export const MANUAL_REASON_MAX_LENGTH = 500;

/**
 * VI-F02-S07 (spec E2, E6, Q4): the form to enter an arrival by hand. The same schema runs in the browser and
 * in the Server Action. Times are wall-clock time at the airport of the booking. The scheduled arrival is
 * asked only for a booking that has no flight yet (the provider did not know the number), so it is optional
 * here and required when `requireScheduled` is true. The reason is required.
 */
export function createManualArrivalSchema({ requireScheduled }: { requireScheduled: boolean }) {
  return z.object({
    arrival_at: z
      .string()
      .trim()
      .min(1, "Arrival is required.")
      .pipe(z.string().refine(isLocalDateTime, "Arrival must be a valid date and time.")),
    scheduled_arrival_at: requireScheduled
      ? z
          .string()
          .trim()
          .min(1, "Scheduled arrival is required.")
          .pipe(z.string().refine(isLocalDateTime, "Scheduled arrival must be a valid date and time."))
      : z.string().trim().pipe(z.string().refine((value) => value === "" || isLocalDateTime(value), "Scheduled arrival must be a valid date and time.")),
    reason: z
      .string()
      .trim()
      .min(1, "Reason is required.")
      .max(MANUAL_REASON_MAX_LENGTH, `Reason must be at most ${MANUAL_REASON_MAX_LENGTH} characters.`),
  });
}

export type ManualArrivalInput = z.infer<ReturnType<typeof createManualArrivalSchema>>;

/** What the Server Action receives: the form values and the booking they are for. */
export const manualArrivalActionSchema = createManualArrivalSchema({ requireScheduled: false }).extend({
  booking_id: z.guid(),
});

export type ManualArrivalActionInput = z.infer<typeof manualArrivalActionSchema>;

export const MANUAL_ARRIVAL_DEFAULTS: ManualArrivalInput = {
  arrival_at: "",
  scheduled_arrival_at: "",
  reason: "",
};
