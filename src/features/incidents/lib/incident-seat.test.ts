import { describe, expect, it } from "vitest";

import { formatIncidentSeat } from "@/features/incidents/lib/incident-seat";

describe("formatIncidentSeat", () => {
  it("should return null when the incident has no seat", () => {
    expect(formatIncidentSeat(null)).toBeNull();
  });

  it("should mark a retired seat and keep its serial number", () => {
    expect(formatIncidentSeat({ serial_number: "SN-2", status: "retired" })).toBe(
      "SN-2 (Retired)",
    );
  });

  it.each([
    ["available"],
    ["reserved"],
    ["in_use"],
    ["cleaning"],
    ["inspection"],
    ["quarantine"],
  ] as const)("should show the serial number alone for a seat that is %s", (status) => {
    expect(formatIncidentSeat({ serial_number: "SN-2", status })).toBe("SN-2");
  });
});
