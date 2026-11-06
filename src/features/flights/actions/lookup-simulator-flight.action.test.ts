import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/features/flights/lib/simulator-lookup", () => ({ lookupSimulatorFlight: lookupMock }));

import { lookupSimulatorFlightAction } from "@/features/flights/actions/lookup-simulator-flight.action";

const PREVIEW = {
  flight_number: "VN123",
  airport_code: "DXB",
  airport_name: "Dubai International Airport",
  time_zone: "Asia/Dubai",
  scheduled_arrival_at: "2026-12-01T10:00:00Z",
  booking: null,
};

describe("lookupSimulatorFlightAction (VI-F02-T02)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ role: "admin" });
    lookupMock.mockReset();
    lookupMock.mockResolvedValue(PREVIEW);
  });

  it("should look the flight up by its normalized number for an admin", async () => {
    const result = await lookupSimulatorFlightAction({ flight_number: " vn 123 " });

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(lookupMock).toHaveBeenCalledWith("VN123");
    expect(result).toEqual({ success: true, flight: PREVIEW });
  });

  it("should return null as the flight when no open booking has the number", async () => {
    lookupMock.mockResolvedValue(null);

    expect(await lookupSimulatorFlightAction({ flight_number: "VN123" })).toEqual({ success: true, flight: null });
  });

  it("should return a validation error and read nothing when the number is not valid", async () => {
    const result = await lookupSimulatorFlightAction({ flight_number: "V" });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("should hide a failed read behind an internal error", async () => {
    lookupMock.mockRejectedValue(new Error("relation flights exploded"));

    const result = await lookupSimulatorFlightAction({ flight_number: "VN123" });

    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message).not.toContain("exploded");
  });

  it("should not read anything when the session is not an admin", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(lookupSimulatorFlightAction({ flight_number: "VN123" })).rejects.toThrow("FORBIDDEN");
    expect(lookupMock).not.toHaveBeenCalled();
  });
});
