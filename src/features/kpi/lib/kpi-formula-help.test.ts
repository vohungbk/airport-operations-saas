import { describe, expect, it } from "vitest";

import { buildAdditionalKpiTiles } from "@/features/kpi/lib/additional-kpi-tiles";
import { buildCoreKpiTiles } from "@/features/kpi/lib/core-kpi-tiles";
import { buildKpiFormulaHelp, buildKpiFormulaHelps } from "@/features/kpi/lib/kpi-formula-help";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import { KPI_DEFINITIONS, getKpiDefinition } from "@/lib/kpi/kpi-definitions";

const CORE: CoreKpis = {
  correct_seat: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
  family_ready_on_time: { state: "no_data" },
  traceability: { state: "not_available", reason: "x" },
  incidents: { state: "value", incidents: 3, completed_bookings: 240, percent: 1.25 },
  commercial: { state: "value", amount: 6000 },
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

describe("buildKpiFormulaHelp (VI-F05-S03, AC01)", () => {
  it("should give the title, the equation, the note, the data source and the two numbers of a rate", () => {
    const help = buildKpiFormulaHelp("correct_seat", "October 2026", CORE.correct_seat);

    expect(help).toEqual({
      id: "correct_seat",
      title: "Correct-seat fulfilment formula",
      equation: "Correct-seat fulfilment = Allocated seat installed ÷ completed bookings × 100",
      note: "Excludes cancelled bookings and no-shows. Based on verified scan and installation records.",
      source: "Data source: Bookings and installation records (seat scan result)",
      row: { label: "October 2026 numerator / denominator", value: "238 / 240" },
    });
  });

  it("should keep the formula and the source when the KPI has no data, and say No data or Not available instead of 0", () => {
    const noData = buildKpiFormulaHelp("family_ready_on_time", "August 2026", { state: "no_data" });
    const missing = buildKpiFormulaHelp("traceability", "August 2026", { state: "not_available", reason: "x" });

    expect(noData.equation).toContain(getKpiDefinition("family_ready_on_time").formula);
    expect(noData.source).toContain("Bookings");
    expect(noData.row?.value).toBe("No data");
    expect(missing.row?.value).toBe("Not available");
  });

  it("should give a KPI that is not a rate no numerator and denominator", () => {
    expect(buildKpiFormulaHelp("refunds", "October 2026").row).toBeNull();
  });
});

describe("buildKpiFormulaHelps (VI-F05-S03, AC01)", () => {
  const helps = buildKpiFormulaHelps(CORE, "October 2026");

  it("should give a formula popover to every tile of the dashboard, core and additional", () => {
    const tiles = [
      ...buildCoreKpiTiles(CORE),
      ...buildAdditionalKpiTiles(ADDITIONAL, CORE.commercial, "October 2026"),
    ];

    expect(tiles).toHaveLength(14);
    for (const tile of tiles) expect(helps[tile.id], tile.id).toBeDefined();
  });

  it("should use the same name for a tile and for its definition, so the popover is about that tile", () => {
    const tiles = [
      ...buildCoreKpiTiles(CORE),
      ...buildAdditionalKpiTiles(ADDITIONAL, CORE.commercial, "October 2026"),
    ];

    for (const tile of tiles) expect(getKpiDefinition(tile.id as never).label, tile.id).toBe(tile.label);
  });

  it("should have a popover for every KPI that is defined", () => {
    expect(Object.keys(helps).sort()).toEqual(KPI_DEFINITIONS.map((definition) => definition.id).sort());
  });

  it("should carry numbers only for the three rates", () => {
    const withRow = Object.values(helps).filter((help) => help.row !== null).map((help) => help.id);

    expect(withRow.sort()).toEqual(["correct_seat", "family_ready_on_time", "traceability"]);
  });
});
