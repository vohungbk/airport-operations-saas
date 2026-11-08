import { describe, expect, it } from "vitest";

import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { buildBaselineEstimate } from "@/features/roi/lib/estimated-value";
import { ESTIMATE_SECTION, SUMMARY_SECTION, VERIFIED_SECTION, buildRoiReportRows } from "@/features/roi/lib/roi-report-rows";
import { buildVerifiedResults } from "@/features/roi/lib/verified-results";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";

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

const CORE: CoreKpis = {
  correct_seat: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
  family_ready_on_time: { state: "value", percent: 97.5, numerator: 234, denominator: 240, excluded: 0 },
  traceability: { state: "value", percent: 100, numerator: 240, denominator: 240, excluded: 0 },
  incidents: { state: "value", incidents: 3, completed_bookings: 240, percent: 1.25 },
  commercial: { state: "value", amount: 6000 },
};

const EMPTY: CoreKpis = {
  correct_seat: { state: "no_data" },
  family_ready_on_time: { state: "no_data" },
  traceability: { state: "no_data" },
  incidents: { state: "no_data" },
  commercial: { state: "no_data" },
};

const ADDITIONAL: AdditionalKpis = {
  seat_utilisation: { state: "value", value: 68 },
  average_rental_duration: { state: "value", value: 5.2 },
  inventory_buffer: { state: "value", seats: 16, airports: "DXB" },
  replacement_rate: { state: "value", percent: 0.8, replacements: 2, rentals: 240 },
  average_preparation: { state: "value", value: 24 },
  installation_time: { state: "value", value: 12 },
  refunds: { state: "value", amount: 150, refunded_bookings: 3 },
  complaints: { state: "not_available", reason: "No complaint record exists yet" },
};

const input = { core: CORE, additional: ADDITIONAL, baseline: BASELINE, period_label: "October 2026", months: 1, trend_months: [], query: "" };

describe("buildRoiReportRows (VI-F05-T03)", () => {
  it("should give the verified results with the values of the screen, marked Verified (AC02)", () => {
    const { rows } = buildRoiReportRows(input);
    const verified = buildVerifiedResults(CORE, ADDITIONAL);

    expect(rows.filter((row) => row.section === VERIFIED_SECTION).map((row) => [row.figure, row.value, row.type])).toEqual(
      verified.rows.map((row) => [row.label, row.value, "Verified"]),
    );
  });

  it("should mark every estimated value as an Estimate and keep it out of the verified rows (AC03)", () => {
    const { rows } = buildRoiReportRows(input);
    const estimate = buildBaselineEstimate(BASELINE, CORE, { period_label: "October 2026", months: 1, verified_revenue_text: "USD 6,000" });

    expect(rows.filter((row) => row.section === ESTIMATE_SECTION).every((row) => row.type === "Estimate")).toBe(true);
    expect(rows.filter((row) => row.section === SUMMARY_SECTION && row.type === "Estimate").map((row) => row.value)).toEqual(
      estimate.cards.map((card) => card.value),
    );
    expect(rows.filter((row) => row.type === "Verified").some((row) => row.figure.startsWith("Estimate"))).toBe(false);
  });

  it("should say Not available for every estimate when no baseline is saved, not 0 (AC04)", () => {
    const { rows } = buildRoiReportRows({ ...input, baseline: null });
    const estimates = rows.filter((row) => row.type === "Estimate" && row.section === SUMMARY_SECTION);

    expect(estimates.length).toBeGreaterThan(0);
    expect(estimates.every((row) => row.value.includes("Not available"))).toBe(true);
  });

  it("should word an empty period as No data and mark it empty (AC06)", () => {
    const { rows, is_empty } = buildRoiReportRows({ ...input, core: EMPTY });

    expect(is_empty).toBe(true);
    expect(rows.find((row) => row.figure === "Verified partner revenue")?.value).toBe("No data");
  });
});
