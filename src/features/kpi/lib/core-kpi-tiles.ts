import { formatKpiFigure, type AmountFigure, type IncidentsFigure, type KpiFigure, NOT_AVAILABLE_TEXT, NO_DATA_TEXT } from "@/lib/kpi/kpi-figures";
import type { KpiTile } from "@/features/kpi/lib/kpi-tile";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";

/**
 * Words the five core KPIs for the tiles of the KPI dashboard (VI-F05-S01, R1, R13, E1, E4). A figure that
 * has nothing to count says No data, one that has nothing stored says Not available: neither is a 0.
 * Pure, no I/O.
 */

export interface CoreKpiTile extends KpiTile {
  id: keyof CoreKpis;
}

export const NO_COMPLETED_RENTALS_CAPTION = "No completed rentals in this period";
export const NO_FAMILY_READY_CAPTION = "No bookings reached Family Ready in this period";

/** `↑ 0.8 pp`, `↓ 1.7 pp` or `No change`: the arrow is never alone, the number says how much. */
function changeText(delta: number, unit: string): string {
  if (delta === 0) return "No change";

  return `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)} ${unit}`;
}

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

/** The change of a rate against the period before, in percentage points; nothing when either has no value. */
function rateChange(current: KpiFigure, previous: KpiFigure | undefined): string | null {
  if (current.state !== "value" || previous?.state !== "value") return null;

  return changeText(roundOneDecimal(current.percent - previous.percent), "pp");
}

export const usd = (amount: number) => {
  const whole = Math.round(amount * 100) % 100 === 0;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
};

function rateTile(
  id: CoreKpiTile["id"],
  label: string,
  figure: KpiFigure,
  options: { withGaps?: boolean; noData?: string; previous?: KpiFigure } = {},
): CoreKpiTile {
  const value = formatKpiFigure(figure);

  if (figure.state === "no_data") return { id, label, value, caption: options.noData ?? NO_COMPLETED_RENTALS_CAPTION };
  if (figure.state === "not_available") return { id, label, value, caption: figure.reason };

  const base = `${figure.numerator} / ${figure.denominator}`;
  const note = figure.excluded > 0
    ? `${base} · ${figure.excluded} left out, data not stored`
    : options.withGaps && figure.numerator === figure.denominator
      ? `${base} · No data gaps`
      : base;
  const change = rateChange(figure, options.previous);

  return { id, label, value, caption: change ? `${note} · ${change}` : note };
}

function incidentsTile(figure: IncidentsFigure, previous: IncidentsFigure | undefined): CoreKpiTile {
  if (figure.state === "no_data") {
    return { id: "incidents", label: "Operational incidents", value: NO_DATA_TEXT, caption: NO_COMPLETED_RENTALS_CAPTION };
  }

  const delta = previous?.state === "value" ? figure.incidents - previous.incidents : null;
  const change = delta === null ? null : changeText(delta, Math.abs(delta) === 1 ? "incident" : "incidents");

  return {
    id: "incidents",
    label: "Operational incidents",
    value: String(figure.incidents),
    caption: change ? `${figure.percent}% · ${change}` : `${figure.percent}%`,
  };
}

function commercialTile(figure: AmountFigure): CoreKpiTile {
  const label = "Commercial performance";

  if (figure.state === "no_data") return { id: "commercial", label, value: NO_DATA_TEXT, caption: NO_COMPLETED_RENTALS_CAPTION };
  if (figure.state === "not_available") return { id: "commercial", label, value: NOT_AVAILABLE_TEXT, caption: figure.reason };

  return { id: "commercial", label, value: usd(figure.amount), caption: "USD · Partner revenue share" };
}

/**
 * The five tiles, in the order of the design. With the figures of the period before, the two rates and the
 * incidents say how they changed; traceability and commercial performance have no change line in the design.
 */
export function buildCoreKpiTiles(kpis: CoreKpis, previous?: CoreKpis | null): CoreKpiTile[] {
  return [
    rateTile("correct_seat", "Correct-seat fulfilment", kpis.correct_seat, { previous: previous?.correct_seat }),
    rateTile("family_ready_on_time", "Family Ready on time", kpis.family_ready_on_time, {
      noData: NO_FAMILY_READY_CAPTION,
      previous: previous?.family_ready_on_time,
    }),
    rateTile("traceability", "Cleaning / inspection traceability", kpis.traceability, { withGaps: true }),
    incidentsTile(kpis.incidents, previous?.incidents),
    commercialTile(kpis.commercial),
  ];
}

/** The period has nothing to show: every figure has nothing to count (E1). */
export function isEmptyPeriod(kpis: CoreKpis): boolean {
  return (
    kpis.correct_seat.state === "no_data" &&
    kpis.family_ready_on_time.state === "no_data" &&
    kpis.traceability.state === "no_data" &&
    kpis.incidents.state === "no_data" &&
    kpis.commercial.state === "no_data"
  );
}
