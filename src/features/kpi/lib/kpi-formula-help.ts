import { NOT_AVAILABLE_TEXT, NO_DATA_TEXT, type KpiFigure } from "@/lib/kpi/kpi-figures";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import { KPI_DEFINITIONS, getKpiDefinition, type KpiId } from "@/lib/kpi/kpi-definitions";

/**
 * The words of the formula popover of a KPI tile (VI-F05-S03, R3), as the design draws it: a title, the
 * equation, a note, and for a rate the two numbers of the period. The data source is added under the note
 * because the story asks for it. The words come from the one list of definitions, so a formula is the
 * same here, on the formula card, in the documents and wherever else a KPI is explained. Pure, no I/O.
 */

export interface KpiFormulaHelp {
  id: KpiId;
  /** `Correct-seat fulfilment formula`. */
  title: string;
  /** `Correct-seat fulfilment = Allocated seat installed ÷ completed bookings × 100`. */
  equation: string;
  note: string;
  /** `Data source: Bookings and installation records`. */
  source: string;
  /** `October numerator / denominator` and `238 / 240`; null for a KPI that is not a rate. */
  row: { label: string; value: string } | null;
}

function pairText(figure: KpiFigure): string {
  if (figure.state === "value") return `${figure.numerator} / ${figure.denominator}`;

  return figure.state === "no_data" ? NO_DATA_TEXT : NOT_AVAILABLE_TEXT;
}

/** The popover of one KPI. A rate carries its numerator and denominator; a missing pair says No data or Not available, never 0. */
export function buildKpiFormulaHelp(id: KpiId, period_label: string, rate?: KpiFigure): KpiFormulaHelp {
  const definition = getKpiDefinition(id);

  return {
    id,
    title: `${definition.label} formula`,
    equation: `${definition.label} = ${definition.formula}`,
    note: definition.note,
    source: `Data source: ${definition.source}`,
    row: rate ? { label: `${period_label} numerator / denominator`, value: pairText(rate) } : null,
  };
}

/** The popover of every tile of the dashboard, by KPI id. */
export function buildKpiFormulaHelps(kpis: CoreKpis, period_label: string): Record<string, KpiFormulaHelp> {
  const rates: Partial<Record<KpiId, KpiFigure>> = {
    correct_seat: kpis.correct_seat,
    family_ready_on_time: kpis.family_ready_on_time,
    traceability: kpis.traceability,
  };

  return Object.fromEntries(KPI_DEFINITIONS.map(({ id }) => [id, buildKpiFormulaHelp(id, period_label, rates[id])]));
}
