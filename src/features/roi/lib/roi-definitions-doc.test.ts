import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ROI_DEFINITIONS } from "@/features/roi/lib/roi-definitions";

const DOC = join(process.cwd(), "docs", "kpi-formulas.md");

/** The rows of the ROI table of docs/kpi-formulas.md. */
function readRows(): string[][] {
  const lines = readFileSync(DOC, "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith("| ROI line | Formula | Data source | Note |"));

  if (start === -1) throw new Error("the ROI table was not found in docs/kpi-formulas.md");

  const rows: string[][] = [];

  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith("|")) break;

    rows.push(line.trim().split("|").slice(1, -1).map((cell) => cell.trim()));
  }

  return rows;
}

describe("documented ROI estimate formulas (VI-F05-S06, spec R8)", () => {
  const rows = readRows();

  it("should document exactly the estimated lines of the dashboard, in the same order", () => {
    expect(rows.map((row) => row[0])).toEqual(ROI_DEFINITIONS.map((definition) => definition.label));
  });

  it.each(ROI_DEFINITIONS.map((definition, index) => [definition.label, definition, index] as const))(
    "should write the formula, the source and the note of %s as the screen does",
    (_label, definition, index) => {
      expect(rows[index]).toEqual([definition.label, definition.formula, definition.source, definition.note]);
    },
  );

  it("should mark every estimated line as an estimate in its note", () => {
    for (const definition of ROI_DEFINITIONS) expect(definition.note).toMatch(/^Estimate/);
  });
});
