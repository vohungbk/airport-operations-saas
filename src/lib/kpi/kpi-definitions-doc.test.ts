import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { KPI_DEFINITIONS } from "@/lib/kpi/kpi-definitions";

interface DocRow {
  label: string;
  formula: string;
  source: string;
  note: string;
}

const DOC = join(process.cwd(), "docs", "kpi-formulas.md");

/** The rows of the table of docs/kpi-formulas.md. */
function readRows(): DocRow[] {
  const lines = readFileSync(DOC, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith("| KPI | Formula | Data source | Note |"));

  if (start === -1) throw new Error("the formulas table was not found in docs/kpi-formulas.md");

  const rows: DocRow[] = [];

  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith("|")) break;

    const [label, formula, source, note] = line.trim().split("|").slice(1, -1).map((cell) => cell.trim());

    rows.push({ label, formula, source, note });
  }

  return rows;
}

describe("documented KPI formulas (VI-F05-S03, AC02, spec R8)", () => {
  const rows = readRows();

  it("should document exactly the KPIs of the dashboard, in the same order", () => {
    expect(rows.map((row) => row.label)).toEqual(KPI_DEFINITIONS.map((definition) => definition.label));
  });

  it.each(KPI_DEFINITIONS)("should document $label with the formula, source and note the screen shows", (definition) => {
    const row = rows.find((candidate) => candidate.label === definition.label);

    expect(row, `no row for ${definition.label}`).toBeDefined();
    expect(row).toEqual({
      label: definition.label,
      formula: definition.formula,
      source: definition.source,
      note: definition.note,
    });
  });
});
