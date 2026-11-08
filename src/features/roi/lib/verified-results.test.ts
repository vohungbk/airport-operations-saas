import { describe, expect, it } from "vitest";

import { buildAdditionalKpiTiles } from "@/features/kpi/lib/additional-kpi-tiles";
import { NO_COMPLETED_RENTALS_CAPTION, buildCoreKpiTiles } from "@/features/kpi/lib/core-kpi-tiles";
import {
  buildVerifiedResults,
  isEmptyRoiPeriod,
  usdLabel,
} from "@/features/roi/lib/verified-results";
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

describe("buildVerifiedResults (VI-F05-S04, AC02, AC03)", () => {
  it("should word the verified revenue, refunds and completed rentals as the design does", () => {
    const { summary, rows } = buildVerifiedResults(CORE, ADDITIONAL);

    expect(summary).toEqual({
      id: "verified_partner_revenue",
      label: "Verified partner revenue",
      value: "USD 6,000",
      caption: "240 completed rentals",
    });
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Verified partner revenue", "USD 6,000"],
      ["Verified refunds", "− USD 150"],
      ["Verified completed rentals", "240"],
    ]);
  });

  it("should show the same revenue as the commercial figure of the KPI dashboard (E6)", () => {
    const { summary } = buildVerifiedResults({ ...CORE, commercial: { state: "value", amount: 1250.5 } }, ADDITIONAL);

    expect(summary.value).toBe("USD 1,250.50");
  });

  it("should say how many rentals are left out of the revenue, as the KPI dashboard does (AC01, AC04, R13)", () => {
    const commercial = { state: "value", amount: 5000, excluded: 40 } as const;
    const { summary } = buildVerifiedResults({ ...CORE, commercial }, ADDITIONAL);
    const kpiTile = buildCoreKpiTiles({ ...CORE, commercial })[4];
    const additionalTile = buildAdditionalKpiTiles(ADDITIONAL, commercial, "October 2026").find((tile) => tile.id === "monthly_partner_revenue");

    expect(summary.value).toBe("USD 5,000");
    expect(kpiTile.value).toBe("$5,000");
    expect(summary.caption).toBe("240 completed rentals · 40 left out, no partner share calculated");
    expect(kpiTile.caption).toContain("40 left out, no partner share calculated");
    expect(additionalTile?.value).toBe(kpiTile.value);
    expect(additionalTile?.caption).toBe("USD · October 2026 · 40 left out, no partner share calculated");
  });

  it("should say Not available with its reason, never USD 0, when no partner share is calculated (R13)", () => {
    const core: CoreKpis = { ...CORE, commercial: { state: "not_available", reason: "No partner share is calculated for these bookings" } };
    const { summary, rows } = buildVerifiedResults(core, ADDITIONAL);

    expect(summary).toMatchObject({ value: "Not available", caption: "No partner share is calculated for these bookings" });
    expect(rows[0].value).toBe("Not available");
  });

  it("should keep a real zero for refunds when rentals are completed and none was refunded", () => {
    const { rows } = buildVerifiedResults(CORE, { ...ADDITIONAL, refunds: { state: "value", amount: 0, refunded_bookings: 0 } });

    expect(rows[1].value).toBe("USD 0");
  });

  it("should say No data for every figure when no rental is completed (E1)", () => {
    const { summary, rows } = buildVerifiedResults(EMPTY_CORE, { ...ADDITIONAL, refunds: { state: "no_data" } });

    expect(summary).toMatchObject({ value: "No data", caption: NO_COMPLETED_RENTALS_CAPTION });
    expect(rows.map((row) => row.value)).toEqual(["No data", "No data", "No data"]);
  });

  it("should write a single rental in the singular", () => {
    const core: CoreKpis = { ...CORE, incidents: { state: "value", incidents: 0, completed_bookings: 1, percent: 0 } };

    expect(buildVerifiedResults(core, ADDITIONAL).summary.caption).toBe("1 completed rental");
  });
});

describe("isEmptyRoiPeriod", () => {
  it("should be empty when no rental is completed", () => {
    expect(isEmptyRoiPeriod(EMPTY_CORE)).toBe(true);
  });

  it("should not be empty when rentals are completed", () => {
    expect(isEmptyRoiPeriod(CORE)).toBe(false);
  });
});

describe("usdLabel", () => {
  it("should write whole amounts without cents and others with two decimals", () => {
    expect(usdLabel(6000)).toBe("USD 6,000");
    expect(usdLabel(0.5)).toBe("USD 0.50");
  });
});
