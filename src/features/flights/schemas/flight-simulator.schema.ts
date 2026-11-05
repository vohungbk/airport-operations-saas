import { z } from "zod";

import { isLocalDateTime } from "@/features/bookings/lib/booking-time";
import { FLIGHT_NUMBER_PATTERN, normalizeFlightNumber } from "@/features/flights/lib/flight-number";
import { flightSnapshotSchema } from "@/features/flights/lib/provider/flight-source";

/** The statuses a flight can have; the simulator offers the same list as every other source. */
export const SIMULATOR_STATUSES = flightSnapshotSchema.shape.status.options;

export type SimulatorStatus = (typeof SIMULATOR_STATUSES)[number];

/**
 * VI-F02-S12 (spec S3, V1 to V3): the Flight simulator form. The same schema runs in the browser and in the
 * Server Action. A field stops at its first problem, so each field shows one clear message. The output equals
 * the form values (the flight number is normalized, which is idempotent), so the Server Action can parse the
 * same input again. The estimated arrival is wall-clock time at the airport of the flight, as in the booking forms.
 */
export const flightSimulatorSchema = z.object({
  flight_number: z
    .string()
    .transform(normalizeFlightNumber)
    .pipe(
      z
        .string()
        .min(1, "Flight number is required.")
        .regex(FLIGHT_NUMBER_PATTERN, "Flight number must be 2 to 8 letters or digits."),
    ),
  estimated_arrival_at: z
    .string()
    .trim()
    .min(1, "Estimated arrival is required.")
    .pipe(z.string().refine(isLocalDateTime, "Estimated arrival must be a valid date and time.")),
  status: z.enum(SIMULATOR_STATUSES, { error: "Select a status." }),
});

export type FlightSimulatorInput = z.infer<typeof flightSimulatorSchema>;

/** What a new form starts with: nothing typed, and a flight that is on schedule. */
export const FLIGHT_SIMULATOR_DEFAULTS: FlightSimulatorInput = {
  flight_number: "",
  estimated_arrival_at: "",
  status: "scheduled",
};
