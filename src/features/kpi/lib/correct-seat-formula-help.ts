import type { KpiFigure } from "@/lib/kpi/kpi-figures";
import { getKpiDefinition } from "@/lib/kpi/kpi-definitions";
import { NOT_AVAILABLE_TEXT, NO_DATA_TEXT } from "@/lib/kpi/kpi-figures";

/**
 * The "Formula help · Correct-seat fulfilment" card of the design (VI-F05-S01). It says the formula in one
 * line and the two numbers behind the tile for the period. The formula names the seat that was allocated,
 * because that is what the figure counts (VI-F05-T02); the design says "correct category", which the PO has
 * still to settle (spec Q1). Pure, no I/O.
 */

const definition = getKpiDefinition("correct_seat");

export const CORRECT_SEAT_FORMULA_TITLE = `Formula help · ${definition.label}`;
export const CORRECT_SEAT_FORMULA = definition.formula;
export const CORRECT_SEAT_FORMULA_NOTE = definition.note;

export interface CorrectSeatFormulaHelp {
  title: string;
  formula: string;
  /** `October 2026 numerator / denominator`. */
  row_label: string;
  /** `238 / 240`, or No data / Not available when there is no pair of numbers to show. */
  row_value: string;
  note: string;
}

export function buildCorrectSeatFormulaHelp(figure: KpiFigure, periodLabel: string): CorrectSeatFormulaHelp {
  const row_value =
    figure.state === "value"
      ? `${figure.numerator} / ${figure.denominator}`
      : figure.state === "no_data"
        ? NO_DATA_TEXT
        : NOT_AVAILABLE_TEXT;

  return {
    title: CORRECT_SEAT_FORMULA_TITLE,
    formula: CORRECT_SEAT_FORMULA,
    row_label: `${periodLabel} numerator / denominator`,
    row_value,
    note: CORRECT_SEAT_FORMULA_NOTE,
  };
}
