import { describe, expect, it } from "vitest";

import {
  FLIGHT_SIMULATOR_DEFAULTS,
  SIMULATOR_STATUSES,
  flightSimulatorSchema,
} from "./flight-simulator.schema";

const VALID = { flight_number: "VN123", estimated_arrival_at: "2026-12-01T09:30", status: "delayed" };

function messageOf(input: unknown, field: string): string | undefined {
  const result = flightSimulatorSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("flightSimulatorSchema (VI-F02-S12)", () => {
  it("should accept a valid flight number, estimated arrival and status", () => {
    expect(flightSimulatorSchema.parse(VALID)).toEqual(VALID);
  });

  it("should start with an empty flight number, an empty arrival and a scheduled flight", () => {
    expect(FLIGHT_SIMULATOR_DEFAULTS).toEqual({
      flight_number: "",
      estimated_arrival_at: "",
      status: "scheduled",
    });
  });

  it("should offer the five statuses of a flight", () => {
    expect(SIMULATOR_STATUSES).toEqual(["scheduled", "delayed", "landed", "cancelled", "diverted"]);
  });

  it("should normalize the flight number the way the booking form does", () => {
    expect(flightSimulatorSchema.parse({ ...VALID, flight_number: " vn 123 " }).flight_number).toBe("VN123");
  });

  it("should return the same value when the output is parsed again", () => {
    const once = flightSimulatorSchema.parse({ ...VALID, flight_number: "vn 123" });

    expect(flightSimulatorSchema.parse(once)).toEqual(once);
  });

  it.each(["", "   "])("should say the flight number is required when it is %j", (flight_number) => {
    expect(messageOf({ ...VALID, flight_number }, "flight_number")).toBe("Flight number is required.");
  });

  it.each(["V", "VN-123", "ABCDEFGHI"])(
    "should reject the flight number %j with a clear message and only one",
    (flight_number) => {
      const result = flightSimulatorSchema.safeParse({ ...VALID, flight_number });

      expect(result.success).toBe(false);
      expect(result.error?.issues.filter((issue) => issue.path[0] === "flight_number")).toHaveLength(1);
      expect(messageOf({ ...VALID, flight_number }, "flight_number")).toBe(
        "Flight number must be 2 to 8 letters or digits.",
      );
    },
  );

  it("should say the estimated arrival is required when it is empty, with one message", () => {
    const result = flightSimulatorSchema.safeParse({ ...VALID, estimated_arrival_at: "" });

    expect(result.error?.issues.filter((issue) => issue.path[0] === "estimated_arrival_at")).toHaveLength(1);
    expect(messageOf({ ...VALID, estimated_arrival_at: "" }, "estimated_arrival_at")).toBe(
      "Estimated arrival is required.",
    );
  });

  it.each(["tomorrow", "2026-13-01T09:30", "2026-02-30T09:30", "2026-12-01T25:00", "2026-12-01"])(
    "should reject the estimated arrival %j as not a valid date and time",
    (estimated_arrival_at) => {
      expect(messageOf({ ...VALID, estimated_arrival_at }, "estimated_arrival_at")).toBe(
        "Estimated arrival must be a valid date and time.",
      );
    },
  );

  it.each(["", "boarding", "LANDED"])("should reject the status %j and ask to select one", (status) => {
    expect(messageOf({ ...VALID, status }, "status")).toBe("Select a status.");
  });

  it("should accept every listed status", () => {
    for (const status of SIMULATOR_STATUSES) {
      expect(flightSimulatorSchema.safeParse({ ...VALID, status }).success).toBe(true);
    }
  });
});
