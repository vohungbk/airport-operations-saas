import { describe, expect, it } from "vitest";

import { flightSnapshotSchema } from "./flight-source";
import { getFlightSource } from "./get-flight-source";

const PROVIDER_ENV = {
  FLIGHT_SOURCE: "provider",
  FLIGHT_PROVIDER_BASE_URL: "https://api.example.com",
  FLIGHT_PROVIDER_API_KEY: "secret-key",
};

describe("getFlightSource", () => {
  it.each([
    [{ FLIGHT_SOURCE: "simulator" }, "simulator"],
    [{ FLIGHT_SOURCE: "sandbox" }, "sandbox"],
    [PROVIDER_ENV, "provider"],
  ])("should return the %# adapter chosen by configuration only", (env, source) => {
    expect(getFlightSource(env).source).toBe(source);
  });

  it("should give the simulator and the sandbox the same interface and the same flight shape", async () => {
    const simulator = getFlightSource({ FLIGHT_SOURCE: "simulator" });
    const sandbox = getFlightSource({ FLIGHT_SOURCE: "sandbox" });

    const fromSimulator = await simulator.fetchFlight("SIM001");
    const fromSandbox = await sandbox.fetchFlight("SB100");

    expect(flightSnapshotSchema.safeParse(fromSimulator).success).toBe(true);
    expect(flightSnapshotSchema.safeParse(fromSandbox).success).toBe(true);
  });

  it("should answer null when the source does not know the flight number", async () => {
    expect(await getFlightSource({ FLIGHT_SOURCE: "simulator" }).fetchFlight("NOPE")).toBeNull();
  });

  it("should find a flight whatever the case of its number", async () => {
    const flight = await getFlightSource({ FLIGHT_SOURCE: "simulator" }).fetchFlight(" sim002 ");

    expect(flight?.flight_number).toBe("SIM002");
  });

  it("should offer a landed flight with its actual arrival, so a demonstration can show it", async () => {
    const flight = await getFlightSource({ FLIGHT_SOURCE: "simulator" }).fetchFlight("SIM003");

    expect(flightSnapshotSchema.safeParse(flight).success).toBe(true);
    expect(flight).toMatchObject({ status: "landed", actual_arrival_at: "2026-12-01T09:40:00Z" });
  });

  it("should refuse to build an adapter from an invalid configuration", () => {
    expect(() => getFlightSource({ FLIGHT_SOURCE: "provider" })).toThrow(/FLIGHT_PROVIDER_BASE_URL/);
  });
});
