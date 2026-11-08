import { describe, expect, it } from "vitest";

import { buildAdditionalKpiTiles } from "@/features/kpi/lib/additional-kpi-tiles";
import { buildCoreKpiTiles } from "@/features/kpi/lib/core-kpi-tiles";
import { ADDITIONAL_SECTION, CORE_SECTION, buildKpiReportRows } from "@/features/kpi/lib/kpi-report-rows";
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

const input = { kpis: KPIS, additional: ADDITIONAL, previous: null, period_label: "October 2026", query: "" };

describe("buildKpiReportRows (VI-F05-T03)", () => {
  it("should give every figure of the screen with the value and the line under it (AC02)", () => {
    const { rows } = buildKpiReportRows(input);
    const tiles = [...buildCoreKpiTiles(KPIS, null), ...buildAdditionalKpiTiles(ADDITIONAL, KPIS.commercial, "October 2026")];

    expect(rows.map((row) => [row.figure, row.value, row.detail])).toEqual(tiles.map((tile) => [tile.label, tile.value, tile.caption]));
    expect(new Set(rows.map((row) => row.section))).toEqual(new Set([CORE_SECTION, ADDITIONAL_SECTION]));
    expect(rows.every((row) => row.type === "Verified")).toBe(true);
  });

  it("should carry the change against the period before when it is given", () => {
    const previous: CoreKpis = { ...KPIS, correct_seat: { state: "value", percent: 98.4, numerator: 236, denominator: 240, excluded: 0 } };

    expect(buildKpiReportRows({ ...input, previous }).rows[0].detail).toBe("238 / 240 · ↑ 0.8 pp");
  });

  it("should say Not available for a figure with no stored input, not 0 (AC04)", () => {
    const complaints = buildKpiReportRows(input).rows.find((row) => row.figure === "Complaints");

    expect(complaints?.value).toBe("Not available");
  });

  it("should keep only the figures the search leaves, as the screen does", () => {
    const { rows } = buildKpiReportRows({ ...input, query: "refunds" });

    expect(rows.map((row) => row.figure)).toEqual(["Refunds"]);
  });

  it("should word an empty period as No data and mark it empty (AC06)", () => {
    const { rows, is_empty } = buildKpiReportRows({ ...input, kpis: EMPTY });

    expect(is_empty).toBe(true);
    expect(rows[0].value).toBe("No data");
  });
});
