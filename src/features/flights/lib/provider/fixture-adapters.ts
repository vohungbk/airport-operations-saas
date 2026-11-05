import type { FlightSnapshot, FlightSource, FlightSourceAdapter } from "./flight-source";

/**
 * An adapter over fixed flights, with no network call. The sandbox and the simulator are the same
 * kind of source with different data, so they share it.
 */
function createFixtureAdapter(
  source: FlightSource,
  flights: readonly FlightSnapshot[],
): FlightSourceAdapter {
  return {
    source,
    async fetchFlight(flight_number: string) {
      const wanted = flight_number.trim().toUpperCase();
      return flights.find((flight) => flight.flight_number === wanted) ?? null;
    },
  };
}

const SANDBOX_FLIGHTS: readonly FlightSnapshot[] = [
  {
    flight_number: "SB100",
    status: "scheduled",
    scheduled_arrival_at: "2026-12-01T10:00:00Z",
    estimated_arrival_at: "2026-12-01T10:00:00Z",
    actual_arrival_at: null,
    terminal: "T1",
    delay_minutes: 0,
  },
];

const SIMULATOR_FLIGHTS: readonly FlightSnapshot[] = [
  {
    flight_number: "SIM001",
    status: "scheduled",
    scheduled_arrival_at: "2026-12-01T10:00:00Z",
    estimated_arrival_at: "2026-12-01T09:30:00Z",
    actual_arrival_at: null,
    terminal: "T1",
    delay_minutes: -30,
  },
  {
    flight_number: "SIM002",
    status: "delayed",
    scheduled_arrival_at: "2026-12-01T10:00:00Z",
    estimated_arrival_at: "2026-12-01T11:00:00Z",
    actual_arrival_at: null,
    terminal: "T2",
    delay_minutes: 60,
  },
  {
    flight_number: "SIM003",
    status: "landed",
    scheduled_arrival_at: "2026-12-01T10:00:00Z",
    estimated_arrival_at: "2026-12-01T09:45:00Z",
    actual_arrival_at: "2026-12-01T09:40:00Z",
    terminal: "T1",
    delay_minutes: -20,
  },
];

export const createSandboxAdapter = () => createFixtureAdapter("sandbox", SANDBOX_FLIGHTS);

export const createSimulatorAdapter = () => createFixtureAdapter("simulator", SIMULATOR_FLIGHTS);
