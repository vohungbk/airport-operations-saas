import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: fromMock }) }));

import { getBaselineInputs } from "@/features/roi/lib/get-baseline-inputs";

const ROW = {
  partner_id: "partner-a",
  monthly_staff_cost: 2400,
  handling_cost_per_rental: 5,
  monthly_inventory_cost: 1500,
  programme_inventory_cost: 700,
  owned_seats: 40,
  average_handling_minutes: 20,
  hourly_staff_cost: 15,
  expected_programme_handling_minutes: 10,
  average_daily_price: 20,
  average_paid_days: 5,
  baseline_conversion_percent: 12,
  programme_conversion_percent: 15,
  qualified_enquiries: 1000,
  average_contribution_per_rental: 50,
  created_at: "2026-11-08T10:00:00Z",
  updated_at: "2026-11-08T11:00:00Z",
  updated_by: "user-1",
};

describe("getBaselineInputs (VI-F05-S05, AC02)", () => {
  beforeEach(() => {
    maybeSingleMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    fromMock.mockReset();
    fromMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  });

  it("should read the baseline of the given partner and give its 14 values", async () => {
    maybeSingleMock.mockResolvedValue({ data: ROW, error: null });

    const saved = await getBaselineInputs("partner-a");

    expect(fromMock).toHaveBeenCalledWith("partner_baseline_inputs");
    expect(eqMock).toHaveBeenCalledWith("partner_id", "partner-a");
    expect(Object.keys(saved ?? {})).toHaveLength(14);
    expect(saved).toMatchObject({ monthly_staff_cost: 2400, owned_seats: 40, programme_conversion_percent: 15 });
    expect(saved).not.toHaveProperty("partner_id");
    expect(saved).not.toHaveProperty("updated_at");
  });

  it("should give null when no baseline is saved yet, or when it is not visible to the caller (Empty)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(getBaselineInputs("partner-b")).resolves.toBeNull();
  });

  it("should throw a generic error, not null, when the read fails (Error)", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: "connection to db.internal:5432 refused" } });

    const failure = await getBaselineInputs("partner-a").catch((error: Error) => error);

    expect((failure as Error).message).toBe("Could not read the baseline inputs");
  });
});
