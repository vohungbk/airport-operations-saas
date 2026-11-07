import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCoreKpisMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kpi/get-core-kpis", () => ({ getCoreKpis: getCoreKpisMock }));
vi.mock("@/features/kpi/components/kpi-period-picker", () => ({
  KpiPeriodPicker: ({
    selected,
    options,
    compare_label,
    compare_on,
    query,
  }: {
    selected: string;
    options: { value: string }[];
    compare_label: string | null;
    compare_on: boolean;
    query: string;
  }) => `PICKER:${selected}:${options.map((option) => option.value).join(",")}|${compare_label}|${compare_on}|q=${query}`,
}));

import { EMPTY_PERIOD_MESSAGE, KpiDashboard } from "@/features/kpi/components/kpi-dashboard";
import { FUTURE_MONTH_MESSAGE } from "@/lib/kpi/kpi-period";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";

const KPIS: CoreKpis = {
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

const render = async (props: { scope_label?: string; period?: string; compare?: string; q?: string } = {}) =>
  renderToStaticMarkup(await KpiDashboard({ scope_label: "Emirates Rent A Car", ...props }));

describe("KpiDashboard (VI-F05-S01)", () => {
  beforeEach(() => {
    getCoreKpisMock.mockReset();
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: KPIS });
  });

  it("should show the heading, the scope, the period and the five core KPIs (success)", async () => {
    const html = await render();

    expect(html).toContain("KPI dashboard");
    expect(html).toContain("Emirates Rent A Car · ");
    expect(html).toContain("Core programme KPIs");
    for (const label of [
      "Correct-seat fulfilment",
      "Family Ready on time",
      "Cleaning / inspection traceability",
      "Operational incidents",
      "Commercial performance",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("99.2%");
    expect(html).toContain("$6,000");
  });

  it("should read the figures for the current month by default, and give the picker its periods", async () => {
    const html = await render();

    expect(getCoreKpisMock).toHaveBeenCalledTimes(2);
    expect(getCoreKpisMock.mock.calls[0][0].from).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/);
    expect(html).toMatch(/PICKER:current:current,ytd,\d{4}-\d{2}/);
  });

  it("should read the figures of a chosen month", async () => {
    const html = await render({ period: "2026-01" });

    expect(getCoreKpisMock).toHaveBeenCalledWith({ from: "2026-01-01T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z" });
    expect(html).toContain("January 2026");
    expect(html).toContain("|December 2025|true|q=");
    expect(html).toContain("PICKER:2026-01");
  });

  it("should show the empty state, and no tile, when the period has no data (empty)", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: EMPTY });

    const html = await render();

    expect(html).toContain(EMPTY_PERIOD_MESSAGE);
    expect(html).not.toContain("Core programme KPIs");
  });

  it("should refuse a month in the future with its message and read nothing (AC04)", async () => {
    const html = await render({ period: "2999-01" });

    expect(html).toContain(FUTURE_MONTH_MESSAGE);
    expect(html).not.toContain("Core programme KPIs");
    expect(getCoreKpisMock).not.toHaveBeenCalled();
  });

  it("should refuse a value that is not a period, and read nothing", async () => {
    const html = await render({ period: "../../etc" });

    expect(html).toContain("That period cannot be shown");
    expect(getCoreKpisMock).not.toHaveBeenCalled();
  });

  it("should throw to the error boundary when the figures cannot be read, never show an empty screen (error)", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: false, reason: "unavailable" });

    await expect(render()).rejects.toThrow("Could not load the KPIs");
  });

  it("should read the month before as well, for the change lines (comparison)", async () => {
    await render({ period: "2026-10" });

    expect(getCoreKpisMock).toHaveBeenCalledWith({ from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" });
  });

  it("should read only the period when the comparison is off", async () => {
    const html = await render({ period: "2026-10", compare: "off" });

    expect(getCoreKpisMock).toHaveBeenCalledTimes(1);
    expect(html).toContain("|September 2026|false|q=");
  });

  it("should still show the figures when the period before cannot be read", async () => {
    getCoreKpisMock.mockResolvedValueOnce({ ok: true, kpis: KPIS }).mockResolvedValueOnce({ ok: false, reason: "unavailable" });

    const html = await render({ period: "2026-10" });

    expect(html).toContain("99.2%");
    expect(html).toContain("238 / 240");
    expect(html).not.toContain(" pp");
  });

  it("should show a change line from the period before", async () => {
    getCoreKpisMock.mockResolvedValueOnce({ ok: true, kpis: KPIS }).mockResolvedValueOnce({
      ok: true,
      kpis: { ...KPIS, correct_seat: { state: "value", percent: 98.4, numerator: 236, denominator: 240, excluded: 0 } },
    });

    expect(await render({ period: "2026-10" })).toContain("238 / 240 · ↑ 0.8 pp");
  });

  it("should not offer a comparison for a period that cannot be shown", async () => {
    expect(await render({ period: "2999-01" })).toContain("|null|true|q=");
  });

  it("should show the formula of Correct-seat fulfilment under the tiles, with the numbers of the period", async () => {
    const html = await render({ period: "2026-10" });

    expect(html).toContain("Formula help · Correct-seat fulfilment");
    expect(html).toContain("Allocated seat installed ÷ completed bookings × 100");
    expect(html).toContain("October 2026 numerator / denominator");
    expect(html).toContain("238 / 240");
    expect(html).toContain("Excludes cancelled bookings and no-shows.");
  });

  it("should narrow the tiles to the search, and pass the search to the picker", async () => {
    const html = await render({ q: "incident" });

    expect(html).toContain("Operational incidents");
    expect(html).not.toContain("Commercial performance");
    expect(html).not.toContain("Formula help");
    expect(html).toContain("|q=incident");
  });

  it("should keep the formula while the Correct-seat tile is one of the tiles left by the search", async () => {
    expect(await render({ q: "seat" })).toContain("Formula help · Correct-seat fulfilment");
  });

  it("should say no KPI matches when the search leaves nothing, and keep the search box", async () => {
    const html = await render({ q: "zzz" });

    expect(html).toContain('No KPI matches &quot;zzz&quot;.');
    expect(html).not.toContain("Core programme KPIs");
    expect(html).toContain("|q=zzz");
  });

  it("should ignore a search that is too long, and show every tile", async () => {
    const html = await render({ q: "a".repeat(200) });

    expect(html).toContain("Commercial performance");
  });

  it("should show no formula card when the period is empty", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: EMPTY });

    expect(await render()).not.toContain("Formula help");
  });
});
