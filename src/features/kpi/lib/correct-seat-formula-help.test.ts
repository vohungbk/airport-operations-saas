import { describe, expect, it } from "vitest";

import {
  CORRECT_SEAT_FORMULA,
  CORRECT_SEAT_FORMULA_NOTE,
  CORRECT_SEAT_FORMULA_TITLE,
  buildCorrectSeatFormulaHelp,
} from "@/features/kpi/lib/correct-seat-formula-help";

describe("buildCorrectSeatFormulaHelp (VI-F05-S01)", () => {
  it("should give the formula, the note and the two numbers of the period", () => {
    const help = buildCorrectSeatFormulaHelp(
      { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
      "October 2026",
    );

    expect(help).toEqual({
      title: CORRECT_SEAT_FORMULA_TITLE,
      formula: CORRECT_SEAT_FORMULA,
      row_label: "October 2026 numerator / denominator",
      row_value: "238 / 240",
      note: CORRECT_SEAT_FORMULA_NOTE,
    });
  });

  it("should name the allocated seat, which is what the figure counts", () => {
    expect(CORRECT_SEAT_FORMULA).toContain("Allocated seat installed");
  });

  it("should say No data or Not available instead of a pair of numbers that does not exist", () => {
    expect(buildCorrectSeatFormulaHelp({ state: "no_data" }, "August 2026").row_value).toBe("No data");
    expect(buildCorrectSeatFormulaHelp({ state: "not_available", reason: "x" }, "August 2026").row_value).toBe(
      "Not available",
    );
  });
});
