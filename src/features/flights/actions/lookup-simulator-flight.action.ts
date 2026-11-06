"use server";

import { z } from "zod";

import { requireRole } from "@/lib/auth/current-user";
import { INTERNAL_ERROR, VALIDATION_ERROR } from "@/features/flights/lib/flight-simulator-errors";
import type { FlightSimulatorError } from "@/features/flights/lib/flight-simulator-errors";
import { lookupSimulatorFlight } from "@/features/flights/lib/simulator-lookup";
import type { SimulatorFlightPreview } from "@/features/flights/lib/simulator-impact";
import { flightSimulatorSchema } from "@/features/flights/schemas/flight-simulator.schema";

export interface LookupSimulatorFlightResult {
  success: boolean;
  /** The flight of the number; null when no open booking has one. */
  flight?: SimulatorFlightPreview | null;
  error?: FlightSimulatorError;
}

const lookupSchema = z.object({ flight_number: flightSimulatorSchema.shape.flight_number });

/**
 * VI-F02-T02: reads the flight of a number for the Flight simulator screen, so the impact can be shown before the
 * change is applied. Only an admin, like the screen. Read-only: it writes nothing and RLS decides what is seen.
 */
export async function lookupSimulatorFlightAction(input: unknown): Promise<LookupSimulatorFlightResult> {
  await requireRole(["admin"]);

  const parsed = lookupSchema.safeParse(input);

  if (!parsed.success) return { success: false, error: VALIDATION_ERROR };

  try {
    return { success: true, flight: await lookupSimulatorFlight(parsed.data.flight_number) };
  } catch {
    return { success: false, error: INTERNAL_ERROR };
  }
}
