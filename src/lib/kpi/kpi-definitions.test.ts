import { describe, expect, it } from "vitest";

import { KPI_DEFINITIONS, getKpiDefinition } from "@/lib/kpi/kpi-definitions";

describe("KPI definitions (VI-F05-S03, AC01, AC02)", () => {
  it("should define the five core KPIs and the nine additional KPIs once each", () => {
    const ids = KPI_DEFINITIONS.map((definition) => definition.id);

    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
  });

  it("should give every KPI a formula, a data source and a note", () => {
    for (const definition of KPI_DEFINITIONS) {
      expect(definition.label.trim(), definition.id).not.toBe("");
      expect(definition.formula.trim(), definition.id).not.toBe("");
      expect(definition.source.trim(), definition.id).not.toBe("");
      expect(definition.note.trim(), definition.id).not.toBe("");
    }
  });

  it("should find a definition by its id", () => {
    expect(getKpiDefinition("seat_utilisation")).toMatchObject({
      label: "Seat utilisation",
      formula: "Rented seat-days ÷ available seat-days × 100",
    });
  });

  it("should name the allocated seat in Correct-seat fulfilment, which is what the figure counts", () => {
    expect(getKpiDefinition("correct_seat").formula).toContain("Allocated seat installed");
  });

  it("should say Complaints has no source yet, never invent one", () => {
    expect(getKpiDefinition("complaints").source).toContain("No source yet");
  });
});
