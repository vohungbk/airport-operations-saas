import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const notMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn(() => ({ not: notMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));
const getFlightSourceConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));
vi.mock("@/features/flights/lib/provider/provider-config", () => ({
  getFlightSourceConfig: getFlightSourceConfigMock,
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { applyFlightSimulationAction } from "@/features/flights/actions/apply-flight-simulation.action";

const FLIGHT_ID = "d5400000-0000-0000-0000-0000000000a1";
const BOOKING_ID = "f0000000-0000-4000-8000-000000000001";

const FLIGHT = {
  id: FLIGHT_ID,
  status: "scheduled",
  scheduled_arrival_at: "2026-12-01T10:00:00Z",
  estimated_arrival_at: "2026-12-01T10:00:00Z",
  actual_arrival_at: null,
  terminal: "T1",
  delay_minutes: 0,
  last_synced_at: "2026-12-01T08:00:00Z",
  bookings: [
    { id: "later", created_at: "2026-11-02T00:00:00Z" },
    { id: BOOKING_ID, created_at: "2026-11-01T00:00:00Z" },
  ],
  airport: { timezone: "Asia/Dubai" },
};

// 13:15 in Dubai (UTC+4) is 09:15 UTC: 45 minutes before the schedule.
const VALID_INPUT = { flight_number: "vn123", estimated_arrival_at: "2026-12-01T13:15", status: "scheduled" };

describe("applyFlightSimulationAction", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ role: "admin" });
    getFlightSourceConfigMock.mockReset();
    getFlightSourceConfigMock.mockReturnValue({ source: "simulator" });
    notMock.mockReset();
    notMock.mockResolvedValue({ data: [FLIGHT], error: null });
    fromMock.mockClear();
    eqMock.mockClear();
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: true, error: null });
  });

  it("should store the change through the admin function and open the Flight tab of the first booking", async () => {
    await expect(applyFlightSimulationAction(VALID_INPUT)).rejects.toThrow(
      `REDIRECT:/bookings/${BOOKING_ID}?tab=flight`,
    );

    expect(requireRoleMock).toHaveBeenCalledWith(["admin"]);
    expect(eqMock).toHaveBeenCalledWith("flight_number", "VN123");
    expect(rpcMock).toHaveBeenCalledWith("apply_simulated_flight_change", {
      p_flight_id: FLIGHT_ID,
      p_values: expect.objectContaining({
        status: "scheduled",
        estimated_arrival_at: "2026-12-01T09:15:00.000Z",
        delay_minutes: -45,
        provider: "simulator",
      }),
      p_changes: [
        { field: "estimated_arrival_at", from: "2026-12-01T10:00:00Z", to: "2026-12-01T09:15:00.000Z" },
        { field: "delay_minutes", from: 0, to: -45 },
      ],
      p_expected_synced_at: "2026-12-01T08:00:00Z",
    });
  });

  it("should not send the expected sync time when the flight was never synced", async () => {
    notMock.mockResolvedValue({ data: [{ ...FLIGHT, last_synced_at: null }], error: null });

    await expect(applyFlightSimulationAction(VALID_INPUT)).rejects.toThrow("REDIRECT");

    expect(rpcMock.mock.calls[0][1]).not.toHaveProperty("p_expected_synced_at");
  });

  it.each([
    ["flight_number", { ...VALID_INPUT, flight_number: "" }, "Flight number is required."],
    ["estimated_arrival_at", { ...VALID_INPUT, estimated_arrival_at: "soon" }, "Estimated arrival must be a valid date and time."],
    ["status", { ...VALID_INPUT, status: "boarding" }, "Select a status."],
  ])("should return the message of the %s field when the server validates it", async (field, input, issue) => {
    const result = await applyFlightSimulationAction(input);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.details).toContainEqual({ field, issue });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should refuse when the active source is not the simulator and write nothing", async () => {
    getFlightSourceConfigMock.mockReturnValue({ source: "provider" });

    const result = await applyFlightSimulationAction(VALID_INPUT);

    expect(result.error?.code).toBe("SOURCE_NOT_SIMULATOR");
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return a general error, not the setup problem, when the source configuration is invalid", async () => {
    getFlightSourceConfigMock.mockImplementation(() => {
      throw new Error("Invalid flight source configuration");
    });

    const result = await applyFlightSimulationAction(VALID_INPUT);

    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message).not.toContain("configuration");
  });

  it("should say the flight was not found when no open booking has the number", async () => {
    notMock.mockResolvedValue({ data: [], error: null });

    const result = await applyFlightSimulationAction(VALID_INPUT);

    expect(result.error?.code).toBe("FLIGHT_NOT_FOUND");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should map a refusal of the database role check to FORBIDDEN", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    const result = await applyFlightSimulationAction(VALID_INPUT);

    expect(result.error?.code).toBe("FORBIDDEN");
  });

  it("should ask to apply again when the flight was refreshed in between", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });

    const result = await applyFlightSimulationAction(VALID_INPUT);

    expect(result.error?.code).toBe("STALE_DATA");
  });

  it("should not show a raw database error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "secret table detail" } });

    const result = await applyFlightSimulationAction(VALID_INPUT);

    expect(result.error?.code).toBe("INTERNAL_ERROR");
    expect(result.error?.message).not.toContain("secret");
  });

  it("should propagate the guard's forbidden for a user who is not an admin and touch nothing", async () => {
    requireRoleMock.mockRejectedValue(
      Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;403"), { digest: "NEXT_HTTP_ERROR_FALLBACK;403" }),
    );

    await expect(applyFlightSimulationAction(VALID_INPUT)).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
