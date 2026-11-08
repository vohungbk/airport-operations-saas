import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePartnerScopeMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requirePartnerScope: requirePartnerScopeMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: rpcMock }) }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("FORBIDDEN_STATE");
  }),
}));

import { saveBaselineInputsAction } from "@/features/roi/actions/save-baseline-inputs.action";

const input = (change: Record<string, unknown> = {}) => ({
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
  ...change,
});

describe("saveBaselineInputsAction (VI-F05-S05, AC06)", () => {
  beforeEach(() => {
    requirePartnerScopeMock.mockReset();
    requirePartnerScopeMock.mockResolvedValue({ id: "u-1", role: "partner_user", partner_id: "partner-a" });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: {}, error: null });
    revalidatePathMock.mockClear();
  });

  it("should save through the database function and refresh the ROI dashboard", async () => {
    await expect(saveBaselineInputsAction(input())).resolves.toEqual({ success: true });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("save_partner_baseline_inputs", {
      p_monthly_staff_cost: 2400,
      p_handling_cost_per_rental: 5,
      p_monthly_inventory_cost: 1500,
      p_programme_inventory_cost: 700,
      p_owned_seats: 40,
      p_average_handling_minutes: 20,
      p_hourly_staff_cost: 15,
      p_expected_programme_handling_minutes: 10,
      p_average_daily_price: 20,
      p_average_paid_days: 5,
      p_baseline_conversion_percent: 12,
      p_programme_conversion_percent: 15,
      p_qualified_enquiries: 1000,
      p_average_contribution_per_rental: 50,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/partner/roi");
    expect(revalidatePathMock).toHaveBeenCalledWith("/partner/roi/baseline");
  });

  it("should check the permission on the server before anything else", async () => {
    requirePartnerScopeMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(saveBaselineInputsAction(input())).rejects.toThrow("FORBIDDEN");
    expect(requirePartnerScopeMock).toHaveBeenCalledWith("bookings:manage_own_partner");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should never take the partner from the request, even when one is sent", async () => {
    await saveBaselineInputsAction(input({ partner_id: "partner-b" }));

    expect(JSON.stringify(rpcMock.mock.calls[0][1])).not.toContain("partner");
  });

  it.each([
    ["a negative current cost", { monthly_staff_cost: -1 }],
    ["a cost with 3 decimals", { handling_cost_per_rental: 5.005 }],
    ["a negative number of seats", { owned_seats: -1 }],
    ["a conversion above 100", { baseline_conversion_percent: 100.01 }],
    ["a conversion below 0", { programme_conversion_percent: -0.01 }],
    ["a missing value", { average_paid_days: undefined }],
    ["a value sent as text", { average_daily_price: "20" }],
    ["a value that is not a number", { average_paid_days: Number.NaN }],
  ])("should answer a validation error and not call the database for %s (AC03 to AC05, VI-F05-S10 AC01)", async (_name, change) => {
    const result = await saveBaselineInputsAction(input(change));

    expect(result).toEqual({ success: false, error: { code: "VALIDATION_ERROR", message: "Check the form and try again." } });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should end in the forbidden state when the database refuses the caller, as the permission was revoked (VI-F05-S12 AC02)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "Not allowed" } });

    await expect(saveBaselineInputsAction(input())).rejects.toThrow("FORBIDDEN_STATE");
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("should answer a generic error and never the raw database error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "connection to db.internal:5432 refused" } });

    const result = await saveBaselineInputsAction(input());

    expect(result).toMatchObject({ success: false, error: { code: "INTERNAL_ERROR" } });
    expect(JSON.stringify(result)).not.toContain("db.internal");
  });
});
