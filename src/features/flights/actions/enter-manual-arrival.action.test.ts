import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn(() => ({ maybeSingle: maybeSingleMock })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ eq: eqMock })));
const fromMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })));

vi.mock("@/lib/auth/current-user", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

import { enterManualArrivalAction } from "@/features/flights/actions/enter-manual-arrival.action";

const BOOKING_ID = "f0000000-0000-4000-8000-000000000001";

const LINKED = {
  id: BOOKING_ID,
  status: "confirmed",
  flight_number: "VN123",
  flight_id: "d5400000-0000-0000-0000-0000000000a1",
  airport: { timezone: "Asia/Dubai" },
  flight: {
    scheduled_arrival_at: "2026-12-01T10:00:00Z",
    status: "scheduled",
    estimated_arrival_at: "2026-12-01T10:00:00Z",
    actual_arrival_at: null,
    terminal: "T1",
    delay_minutes: 0,
    last_synced_at: "2026-12-01T08:00:00Z",
  },
};

const NOT_FOUND_AT_PROVIDER = { ...LINKED, flight_id: null, flight: null };

// 15:20 in Dubai (UTC+4) is 11:20 UTC: 80 minutes after the schedule.
const VALID_INPUT = { booking_id: BOOKING_ID, arrival_at: "2026-12-01T15:20", scheduled_arrival_at: "", reason: "Passenger called" };

describe("enterManualArrivalAction (VI-F02-S07)", () => {
  beforeEach(() => {
    requireRoleMock.mockReset();
    requireRoleMock.mockResolvedValue({ role: "operations_manager" });
    fromMock.mockClear();
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: LINKED, error: null });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: LINKED.flight_id, error: null });
  });

  it("should store the arrival with its reason through the database function for a linked flight", async () => {
    const result = await enterManualArrivalAction(VALID_INPUT);

    expect(result).toEqual({ success: true });
    expect(requireRoleMock).toHaveBeenCalledWith(["admin", "operations_manager"]);
    expect(rpcMock).toHaveBeenCalledWith("enter_manual_arrival", {
      p_booking_id: BOOKING_ID,
      p_values: expect.objectContaining({
        estimated_arrival_at: "2026-12-01T11:20:00.000Z",
        delay_minutes: 80,
        provider: "manual",
      }),
      p_changes: [
        { field: "estimated_arrival_at", from: "2026-12-01T10:00:00Z", to: "2026-12-01T11:20:00.000Z" },
        { field: "delay_minutes", from: 0, to: 80 },
      ],
      p_reason: "Passenger called",
      p_expected_synced_at: "2026-12-01T08:00:00Z",
    });
  });

  it("should make the flight from the scheduled arrival when the provider did not know the number", async () => {
    maybeSingleMock.mockResolvedValue({ data: NOT_FOUND_AT_PROVIDER, error: null });

    const result = await enterManualArrivalAction({ ...VALID_INPUT, scheduled_arrival_at: "2026-12-01T14:00" });

    expect(result.success).toBe(true);
    const args = rpcMock.mock.calls[0][1];
    expect(args.p_scheduled_arrival_at).toBe("2026-12-01T10:00:00.000Z");
    expect(args.p_values).toMatchObject({ delay_minutes: 80, status: "scheduled" });
    expect(args).not.toHaveProperty("p_expected_synced_at");
  });

  it("should ask for the scheduled arrival when the booking has no flight yet", async () => {
    maybeSingleMock.mockResolvedValue({ data: NOT_FOUND_AT_PROVIDER, error: null });

    const result = await enterManualArrivalAction(VALID_INPUT);

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.details).toContainEqual({ field: "scheduled_arrival_at", issue: "Scheduled arrival is required." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return an error and write nothing when the reason is empty", async () => {
    const result = await enterManualArrivalAction({ ...VALID_INPUT, reason: "   " });

    expect(result.error?.code).toBe("VALIDATION_ERROR");
    expect(result.error?.details).toContainEqual({ field: "reason", issue: "Reason is required." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should return an error when the arrival is not a date and time", async () => {
    const result = await enterManualArrivalAction({ ...VALID_INPUT, arrival_at: "soon" });

    expect(result.error?.details).toContainEqual({ field: "arrival_at", issue: "Arrival must be a valid date and time." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should refuse an ended booking before it writes", async () => {
    maybeSingleMock.mockResolvedValue({ data: { ...LINKED, status: "completed" }, error: null });

    expect((await enterManualArrivalAction(VALID_INPUT)).error?.code).toBe("BOOKING_ENDED");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should say not found when the booking cannot be read", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    expect((await enterManualArrivalAction(VALID_INPUT)).error?.code).toBe("NOT_FOUND");
  });

  it("should say there is no change when the arrival is the one already stored", async () => {
    const result = await enterManualArrivalAction({ ...VALID_INPUT, arrival_at: "2026-12-01T14:00" });

    expect(result.error?.code).toBe("NO_CHANGE");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should say the flight was changed by someone else when the function writes nothing", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    expect((await enterManualArrivalAction(VALID_INPUT)).error?.code).toBe("STALE_DATA");
  });

  it("should map a refusal of the database role check to FORBIDDEN", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });

    const result = await enterManualArrivalAction(VALID_INPUT);

    expect(result.error?.code).toBe("FORBIDDEN");
    expect(result.error?.message).not.toContain("denied");
  });

  it("should not read or write anything when the role check of the session throws", async () => {
    requireRoleMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(enterManualArrivalAction(VALID_INPUT)).rejects.toThrow("FORBIDDEN");
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
