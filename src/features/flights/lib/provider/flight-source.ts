import { z } from "zod";

/** The three places flight data can come from. One adapter interface serves all of them. */
export const FLIGHT_SOURCES = ["provider", "sandbox", "simulator"] as const;

export type FlightSource = (typeof FLIGHT_SOURCES)[number];

const timestamp = z.iso.datetime({ offset: true });

/** One flight as an adapter returns it, whichever source it came from (snake_case, as the DB). */
export const flightSnapshotSchema = z.object({
  flight_number: z.string().trim().min(1),
  status: z.enum(["scheduled", "delayed", "landed", "cancelled", "diverted"]),
  scheduled_arrival_at: timestamp,
  estimated_arrival_at: timestamp.nullable(),
  actual_arrival_at: timestamp.nullable(),
  terminal: z.string().nullable(),
  delay_minutes: z.number().int().nullable(),
});

export type FlightSnapshot = z.infer<typeof flightSnapshotSchema>;

/**
 * VI-F02-S09 (spec R11): the one interface the app uses to read a flight. The live provider, the
 * sandbox data and the simulator implement it, so the code that uses a flight never knows which
 * source it talks to.
 */
export interface FlightSourceAdapter {
  readonly source: FlightSource;
  /** The flight, or null when the source does not know the flight number. */
  fetchFlight(flight_number: string): Promise<FlightSnapshot | null>;
}
