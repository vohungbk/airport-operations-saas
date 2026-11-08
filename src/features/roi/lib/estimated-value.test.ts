import { describe, expect, it } from "vitest";

import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { buildBaselineEstimate, buildTotalTrend, estimateAmount } from "@/features/roi/lib/estimated-value";
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

const CONTEXT = { period_label: "October 2026", months: 1, verified_revenue_text: "USD 6,000" };

const view = () => buildBaselineEstimate(BASELINE, CORE, CONTEXT);

describe("the estimated business value (VI-F05-S06, AC01, AC02)", () => {
  it("should word the three cards of the design, each marked as an estimate", () => {
    expect(view().cards).toEqual([
      { id: "estimated_avoided_costs", label: "Estimated avoided costs", value: "USD 2,000", caption: "Estimate · Baseline model" },
      { id: "estimated_conversion_value", label: "Estimated conversion value", value: "USD 1,500", caption: "Estimate · 30 incremental rentals" },
      { id: "total_partner_value_created", label: "Total partner value created", value: "USD 9,500", caption: "Estimate · October 2026" },
    ]);
  });

  it("should word every estimated line and cell with the label Estimate (AC02)", () => {
    const { lines, breakdown } = view();

    expect(lines.map((line) => line.value)).toEqual(["USD 1,200 · Estimate", "USD 800 · Estimate", "USD 1,500 · Estimate"]);
    for (const cell of [...lines.flatMap((line) => [line.label, line.value]), ...breakdown.flatMap((row) => [row.baseline, row.scenario, row.estimated])]) {
      expect(cell).toContain("Estimate");
    }
    expect(breakdown[0]).toEqual({ category: "Staff handling", baseline: "USD 2,400 · Estimate", scenario: "USD 1,200 · Estimate", estimated: "USD 1,200 · Estimate" });
  });

  it("should draw the bars against the longest one, with the verified revenue named beside the estimates", () => {
    const { series } = view();

    expect(series.map((bar) => bar.label)).toEqual([
      "Verified partner revenue · USD 6,000",
      "Estimate · Avoided handling · USD 1,200 · Estimate",
      "Estimate · Inventory savings · USD 800 · Estimate",
      "Estimate · Conversion value · USD 1,500 · Estimate",
    ]);
    expect(series.map((bar) => bar.share)).toEqual([100, 20, 13.3, 25]);
    expect(series.map((bar) => bar.tone)).toEqual(["primary", "secondary", "primary", "secondary"]);
  });

  it.each([
    [{ programme_conversion_percent: 11.87, qualified_enquiries: 970 }, "− USD 63", "Estimate · −1.3 incremental rentals"],
    [{ programme_conversion_percent: 11.9, qualified_enquiries: 1000 }, "− USD 50", "Estimate · −1 incremental rental"],
    [{ programme_conversion_percent: 12.1, qualified_enquiries: 1000 }, "USD 50", "Estimate · 1 incremental rental"],
  ])("should write the negative and the single conversion case the same way in the value and the caption (%j)", (change, value, caption) => {
    const card = buildBaselineEstimate({ ...BASELINE, ...change }, CORE, CONTEXT).cards[1];

    expect(card.value).toBe(value);
    expect(card.caption).toBe(caption);
  });

  it("should write a negative estimate with a minus, and a missing figure as Not available, never 0", () => {
    expect(estimateAmount(-800)).toBe("− USD 800");
    expect(estimateAmount(1250.5)).toBe("USD 1,250.50");
    expect(estimateAmount(null)).toBe("Not available");
  });

  const NO_REVENUE: CoreKpis = { ...CORE, commercial: { state: "not_available", reason: "No share is calculated" } };
  const noRevenueView = () => buildBaselineEstimate(BASELINE, NO_REVENUE, { ...CONTEXT, verified_revenue_text: "Not available" });

  it("should say Not available on the total card when the verified revenue is not available, and still give the lines", () => {
    const { cards, lines } = noRevenueView();

    expect(cards[2].value).toBe("Not available");
    expect(cards[2].caption).toBe("Estimate · October 2026");
    expect(cards[0].value).toBe("USD 2,000");
    expect(lines[0].value).toBe("USD 1,200 · Estimate");
  });

  it("should draw no bar for the verified revenue when it is not available", () => {
    const { series } = noRevenueView();

    expect(series[0]).toMatchObject({ label: "Verified partner revenue · Not available", share: 0 });
  });
});

describe("buildBaselineEstimate without a baseline (VI-F05-S06, AC03, E2, R13)", () => {
  const frame = (baseline: BaselineValues | null | undefined, core: CoreKpis = CORE) => buildBaselineEstimate(baseline, core, CONTEXT);

  it.each([
    ["no baseline is saved", null],
    ["the page gives no baseline (the internal team)", undefined],
  ])("should keep the whole frame and say Not available, never 0, when %s", (_name, baseline) => {
    const { cards, lines, breakdown, series } = frame(baseline);

    expect(cards.map((card) => card.value)).toEqual(["Not available", "Not available", "Not available"]);
    expect(cards.map((card) => card.caption)).toEqual([
      "Estimate · No baseline saved yet",
      "Estimate · No baseline saved yet",
      "Estimate · October 2026",
    ]);
    expect(lines.map((line) => line.value)).toEqual(["Not available · Estimate", "Not available · Estimate", "Not available · Estimate"]);
    expect(breakdown.map((row) => row.category)).toEqual(["Staff handling", "Owned inventory", "Customer conversion"]);
    for (const row of breakdown) expect([row.baseline, row.scenario, row.estimated]).toEqual(Array(3).fill("Not available · Estimate"));
    expect(series.map((bar) => bar.share)).toEqual([100, 0, 0, 0]);
  });

  it("should invent no number: nothing of the frame carries a digit except the verified revenue", () => {
    const { cards, lines, breakdown } = frame(null);
    const words = [...cards.slice(0, 2).flatMap((card) => [card.value, card.caption]), ...lines.map((line) => line.value), ...breakdown.flatMap((row) => [row.baseline, row.scenario, row.estimated])];

    for (const word of words) expect(word).not.toMatch(/\d/);
  });

  it("should keep the frame, not a made-up estimate, when the period has no completed rental", () => {
    const core: CoreKpis = { ...CORE, incidents: { state: "no_data" } };

    expect(frame(BASELINE, core).cards[0].value).toBe("Not available");
  });
});

describe("the monthly total of the trend (VI-F05-S07, AC01, AC02)", () => {
  const month = (label: string, core: CoreKpis | null) => ({ label, core });
  const SMALL: CoreKpis = { ...CORE, incidents: { state: "value", incidents: 0, completed_bookings: 100, percent: 0 }, commercial: { state: "value", amount: 2500 } };

  it("should give each month its verified revenue plus its own estimated lines, and word them as an estimate", () => {
    const trend = buildTotalTrend(BASELINE, [month("Sep", SMALL), month("Oct", CORE)]);

    // 100 rentals: 500 handling + 800 inventory + 1,500 conversion on top of 2,500 revenue.
    expect(trend.points).toEqual([
      { label: "Sep", value: 5300 },
      { label: "Oct", value: 9500 },
    ]);
    expect(trend.summary).toBe("Estimate monthly total: Sep USD 5,300 · Oct USD 9,500");
  });

  it("should end on the total of a one-month period, so the trend and the card agree (AC02)", () => {
    const last = buildTotalTrend(BASELINE, [month("Oct", CORE)]).points[0].value;

    expect(estimateAmount(last)).toBe(view().cards[2].value);
  });

  it("should say Not available for a month that cannot be read or has no verified revenue, never 0", () => {
    const noRevenue: CoreKpis = { ...CORE, commercial: { state: "not_available", reason: "No share is calculated" } };
    const trend = buildTotalTrend(BASELINE, [month("Aug", null), month("Sep", noRevenue), month("Oct", CORE)]);

    expect(trend.points.map((point) => point.value)).toEqual([null, null, 9500]);
    expect(trend.summary).toBe("Estimate monthly total: Aug Not available · Sep Not available · Oct USD 9,500");
  });

  it("should give no total for any month when no baseline is saved", () => {
    const trend = buildTotalTrend(null, [month("Oct", CORE)]);

    expect(trend.points).toEqual([{ label: "Oct", value: null }]);
    expect(trend.summary).toBe("Estimate monthly total: Oct Not available");
  });

  it("should carry the trend in the view built for the dashboard", () => {
    const withTrend = buildBaselineEstimate(BASELINE, CORE, { ...CONTEXT, trend_months: [month("Oct", CORE)] });

    expect(withTrend.trend.points).toEqual([{ label: "Oct", value: 9500 }]);
    expect(view().trend.points).toEqual([]);
  });
});
