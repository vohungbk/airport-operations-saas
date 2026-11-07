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

const render = async (props: { period?: string; q?: string; scope_note?: string } = {}) =>
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

  it("should mark the estimated business value as an estimate and show no estimated number", async () => {
    const html = await render();

    expect(html).toContain("Estimated business value");
    expect(html).toContain("Estimated avoided costs");
    expect(html).toContain("Estimate · No baseline saved yet");
    expect(html).not.toMatch(/USD 3,500|USD 1,500|USD 9,500/);
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
});
