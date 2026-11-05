import { z } from "zod";

import type { Database } from "@/types/database.types";

type FlightStatus = Database["public"]["Enums"]["flight_status"];

/** The statuses of the Status filter, in the order of the design (VI-F02-S08). */
export const FLIGHT_BOARD_STATUSES = [
  "scheduled",
  "delayed",
  "landed",
  "cancelled",
  "diverted",
] as const satisfies readonly FlightStatus[];

/**
 * `searchParams` is user-editable URL state: a garbled value falls back to the default instead of
 * failing the page. Without `airport_id` the board opens the first airport.
 */
export const flightBoardQuerySchema = z.object({
  airport_id: z.guid().optional().catch(undefined),
  status: z.enum(FLIGHT_BOARD_STATUSES).optional().catch(undefined),
});

export type FlightBoardQuery = z.infer<typeof flightBoardQuerySchema>;
