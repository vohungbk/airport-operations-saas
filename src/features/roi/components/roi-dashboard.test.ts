import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCoreKpisMock = vi.hoisted(() => vi.fn());
const getAdditionalKpisMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kpi/get-core-kpis", () => ({ getCoreKpis: getCoreKpisMock }));
vi.mock("@/lib/kpi/get-additional-kpis", () => ({ getAdditionalKpis: getAdditionalKpisMock }));
vi.mock("@/features/kpi/components/kpi-period-picker", () => ({
  KpiPeriodPicker: ({ selected, query }: { selected: string; query: string }) => `PICKER:${selected}|q=${query}`,
}));

import { EMPTY_ROI_PERIOD_MESSAGE, RoiDashboard } from "@/features/roi/components/roi-dashboard";
import { FUTURE_MONTH_MESSAGE } from "@/lib/kpi/kpi-period";
import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";

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

const CORE: CoreKpis = {
  correct_seat: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
  family_ready_on_time: { state: "value", percent: 97.5, numerator: 234, denominator: 240, excluded: 0 },
  traceability: { state: "value", percent: 100, numerator: 240, denominator: 240, excluded: 0 },
  incidents: { state: "value", incidents: 3, completed_bookings: 240, percent: 1.25 },
  commercial: { state: "value", amount: 6000 },
};

const EMPTY_CORE: CoreKpis = {
  correct_seat: { state: "no_data" },
  family_ready_on_time: { state: "no_data" },
  traceability: { state: "no_data" },
  incidents: { state: "no_data" },
  commercial: { state: "no_data" },
};

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

const render = async (props: { period?: string; q?: string; scope_note?: string; edit_baseline_href?: string; baseline?: BaselineValues | null } = {}) =>
  renderToStaticMarkup(await RoiDashboard({ scope_label: "Emirates Rent A Car", ...props }));

describe("RoiDashboard (VI-F05-S04)", () => {
  beforeEach(() => {
    getCoreKpisMock.mockReset();
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: CORE });
    getAdditionalKpisMock.mockReset();
    getAdditionalKpisMock.mockResolvedValue({ ok: true, kpis: ADDITIONAL });
  });

  it("should show the verified results of the period (success, AC02)", async () => {
    const html = await render({ scope_note: "Your partner data only" });

    expect(html).toContain("ROI dashboard");
    expect(html).toContain("Emirates Rent A Car · ");
    expect(html).toContain("Your partner data only");
    expect(html).toContain("Verified results");
    expect(html).toContain("USD 6,000");
    expect(html).toContain("240 completed rentals");
    expect(html).toContain("− USD 150");
    expect(html).toContain("Verified completed rentals");
  });

  it("should read the figures for the period of the address, from the database only (AC03)", async () => {
    await render({ period: "2026-10" });

    const range = { from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" };
    expect(getCoreKpisMock).toHaveBeenCalledWith(range);
    expect(getAdditionalKpisMock).toHaveBeenCalledWith(range);
  });

  it("should keep the whole Estimated business value frame, saying Not available, when no baseline is saved (VI-F05-S06, AC03, E2)", async () => {
    for (const baseline of [null, undefined]) {
      const html = await render({ baseline });

      expect(html).toContain("Verified results");
      expect(html).toContain("USD 6,000");
      expect(html).toContain("Estimated business value");
      expect(html).toContain("Estimated avoided costs");
      expect(html).toContain("Total partner value created");
      expect(html).toContain("Estimate · No baseline saved yet");
      expect(html).toContain("Not available · Estimate");
      expect(html).not.toMatch(/USD 9,500|USD 3,500|USD 1,500|USD 1,200/);
    }
  });

  it("should show the estimate with the total partner value, marked Estimate, when a baseline is saved (VI-F05-S06, AC01)", async () => {
    const html = await render({ baseline: BASELINE, period: "2026-10" });

    expect(html).toContain("Estimated business value");
    expect(html).toContain("Estimated avoided costs");
    expect(html).toContain("Total partner value created");
    expect(html).toContain("USD 9,500");
    expect(html).toContain("Estimate · October 2026");
    expect(html).toContain("USD 1,200 · Estimate");
    expect(html).toContain("USD 800 · Estimate");
  });

  it("should keep the verified results as they are when an estimate is shown, never mixing the estimate in (VI-F05-S06, AC02)", async () => {
    const withEstimate = await render({ baseline: BASELINE });
    const verified = withEstimate.slice(withEstimate.indexOf('id="verified-results-heading"'), withEstimate.indexOf('id="estimated-value-heading"'));

    expect(verified).toContain("USD 6,000");
    expect(verified).toContain("240");
    expect(verified).not.toMatch(/USD 9,500|USD 3,500|USD 1,500|USD 1,200|Estimate/);
  });

  it("should read the figures of one month for a month and of the months so far for year to date (VI-F05-S06, AC01)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));

    try {
      expect(await render({ baseline: BASELINE, period: "2026-10" })).toContain("USD 9,500");
      // Ten months of inventory savings (8,000) and of conversion value (15,000), and 240 rentals of handling (1,200).
      const html = await render({ baseline: BASELINE, period: "ytd" });

      expect(html).toContain("USD 30,200");
      expect(html).toContain("USD 9,200");
    } finally {
      vi.useRealTimers();
    }
  });

  it("should show the monthly trend of the last six months with the total, marked Estimate (VI-F05-S07, AC01)", async () => {
    const html = await render({ baseline: BASELINE, period: "2026-10" });

    expect(html).toContain("Value breakdown and trend · Estimate");
    expect(html).toContain(
      "Estimate monthly total: May USD 9,500 · Jun USD 9,500 · Jul USD 9,500 · Aug USD 9,500 · Sep USD 9,500 · Oct USD 9,500",
    );
  });

  it("should read the same calendar months for a month and for year to date, ending with the last month of the period (VI-F05-S07, AC02)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));

    try {
      getCoreKpisMock.mockClear();
      await render({ baseline: BASELINE, period: "ytd" });

      const froms = getCoreKpisMock.mock.calls.map(([range]) => range.from);

      expect(froms).toEqual(expect.arrayContaining(["2026-01-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"]));
      expect(getCoreKpisMock).toHaveBeenCalledWith({ from: "2026-10-01T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("should read no month for the trend and draw none when no baseline is saved (VI-F05-S07, R13)", async () => {
    const html = await render({ baseline: null, period: "2026-10" });

    expect(getCoreKpisMock).toHaveBeenCalledTimes(1);
    expect(html).not.toContain("Estimate monthly total");
  });

  it("should say Not available for a month that cannot be read and keep the others (VI-F05-S07, E3)", async () => {
    getCoreKpisMock.mockResolvedValueOnce({ ok: true, kpis: CORE });
    getCoreKpisMock.mockResolvedValueOnce({ ok: false, reason: "unavailable" });

    const html = await render({ baseline: BASELINE, period: "2026-10" });

    expect(html).toContain("Estimate monthly total: May Not available");
    expect(html).toContain("Oct USD 9,500");
  });

  it("should say Not available on the total, not 0, when the verified revenue is not available (VI-F05-S06, R13)", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: { ...CORE, commercial: { state: "not_available", reason: "No share is calculated" } } });

    const html = await render({ baseline: BASELINE });

    expect(html).toContain("Total partner value created");
    expect(html).toMatch(/Total partner value created[\s\S]*Not available/);
    expect(html).not.toContain("USD 3,500");
  });

  it("should draw no estimate on an empty period even when a baseline is saved (E1)", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: EMPTY_CORE });

    const html = await render({ baseline: BASELINE });

    expect(html).toContain(EMPTY_ROI_PERIOD_MESSAGE);
    expect(html).not.toContain("Estimated business value");
  });

  it("should show the empty state, with no figure of zero, when no rental is completed (empty, E1)", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: EMPTY_CORE });

    const html = await render();

    expect(html).toContain(EMPTY_ROI_PERIOD_MESSAGE);
    expect(html).not.toContain("Verified results");
    expect(html).not.toContain("USD 0");
  });

  it("should refuse a period in the future with its message and read nothing", async () => {
    const html = await render({ period: "2999-01" });

    expect(html).toContain(FUTURE_MONTH_MESSAGE);
    expect(getCoreKpisMock).not.toHaveBeenCalled();
    expect(getAdditionalKpisMock).not.toHaveBeenCalled();
  });

  it("should throw to the error boundary when a read fails, never show a made-up figure (error)", async () => {
    getAdditionalKpisMock.mockResolvedValue({ ok: false, reason: "unavailable" });

    await expect(render()).rejects.toThrow("Could not load the ROI dashboard");
  });

  it("should narrow the cards to the words searched and say so when none matches", async () => {
    const html = await render({ q: "refunds" });
    expect(html).toContain("Verified refunds");
    expect(html).not.toContain("Verified completed rentals");

    expect(await render({ q: "zzz" })).toContain('No result matches &quot;zzz&quot;.');
  });

  it("should draw the Edit baseline inputs button when the partner page gives it a place to go (VI-F05-S05, AC07)", async () => {
    const html = await render({ edit_baseline_href: "/partner/roi/baseline" });

    expect(html).toMatch(/<a[^>]*href="\/partner\/roi\/baseline"[^>]*>Edit baseline inputs<\/a>/);
  });

  it("should draw no Edit baseline inputs button for the internal team, which gets no place to go (VI-F05-S05, AC07)", async () => {
    expect(await render()).not.toContain("Edit baseline inputs");
  });

  it("should still draw the Edit baseline inputs button on an empty period, so the baseline can be entered first (VI-F05-S05, AC07)", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: EMPTY_CORE });

    expect(await render({ edit_baseline_href: "/partner/roi/baseline" })).toContain("Edit baseline inputs");
  });
});
