import { describe, expect, it } from "vitest";

import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { calculateEstimate } from "@/features/roi/lib/estimate";

/** The baseline of the design (frame G3). */
const BASELINE: BaselineValues = {
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
};

const MONTH = { rentals: 240, months: 1, verified_revenue: 6000 };

describe("calculateEstimate (VI-F05-S06, AC01)", () => {
  it("should give the figures of the design for the baseline and the rentals of the design", () => {
    const estimate = calculateEstimate(BASELINE, MONTH);

    expect(estimate).toMatchObject({
      avoided_handling: 1200,
      inventory_savings: 800,
      conversion_value: 1500,
      incremental_rentals: 30,
      avoided_costs: 2000,
      verified_revenue: 6000,
      total_partner_value: 9500,
    });
  });

  it("should give the breakdown table of the design", () => {
    expect(calculateEstimate(BASELINE, MONTH).breakdown).toEqual([
      { id: "staff_handling", baseline: 2400, scenario: 1200, estimated: 1200 },
      { id: "owned_inventory", baseline: 1500, scenario: 700, estimated: 800 },
      { id: "customer_conversion", baseline: 0, scenario: 1500, estimated: 1500 },
    ]);
  });

  it("should keep the verified revenue out of every estimated line (AC02)", () => {
    const low = calculateEstimate(BASELINE, { ...MONTH, verified_revenue: 100 });
    const high = calculateEstimate(BASELINE, { ...MONTH, verified_revenue: 900000 });

    expect([low.avoided_handling, low.inventory_savings, low.conversion_value]).toEqual([
      high.avoided_handling,
      high.inventory_savings,
      high.conversion_value,
    ]);
    expect(low.total_partner_value).toBe(3600);
    expect(high.total_partner_value).toBe(903500);
  });

  it("should multiply the monthly lines by the months of a year to date, and the rentals line by the rentals of the period", () => {
    const estimate = calculateEstimate(BASELINE, { rentals: 720, months: 3, verified_revenue: 18000 });

    expect(estimate).toMatchObject({ avoided_handling: 3600, inventory_savings: 2400, incremental_rentals: 90, conversion_value: 4500 });
    expect(estimate.breakdown[0]).toMatchObject({ baseline: 7200, scenario: 3600 });
  });

  it("should give zero lines, not a missing value, when the baseline gives no saving", () => {
    const flat = { ...BASELINE, handling_cost_per_rental: 0, programme_inventory_cost: 1500, programme_conversion_percent: 12 };

    expect(calculateEstimate(flat, MONTH)).toMatchObject({ avoided_handling: 0, inventory_savings: 0, conversion_value: 0, total_partner_value: 6000 });
  });

  it("should give a negative line when the programme costs more or converts less, and not hide it", () => {
    const worse = { ...BASELINE, programme_inventory_cost: 2000, programme_conversion_percent: 10 };
    const estimate = calculateEstimate(worse, MONTH);

    expect(estimate.inventory_savings).toBe(-500);
    expect(estimate.incremental_rentals).toBe(-20);
    expect(estimate.conversion_value).toBe(-1000);
  });

  it("should give no total when the verified revenue is not available, and still give the lines", () => {
    const estimate = calculateEstimate(BASELINE, { ...MONTH, verified_revenue: null });

    expect(estimate.total_partner_value).toBeNull();
    expect(estimate).toMatchObject({ avoided_costs: 2000, conversion_value: 1500, verified_revenue: null });
  });

  it("should keep the cents exact, so a sum does not carry the noise of a float", () => {
    const estimate = calculateEstimate({ ...BASELINE, handling_cost_per_rental: 0.1, monthly_inventory_cost: 0.2, programme_inventory_cost: 0 }, { ...MONTH, rentals: 1 });

    expect(estimate.avoided_costs).toBe(0.3);
  });
});
