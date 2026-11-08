import { NO_COMPLETED_RENTALS_CAPTION, commercialGapNote, joinCaption, usd } from "@/features/kpi/lib/core-kpi-tiles";
import type { KpiTile } from "@/features/kpi/lib/kpi-tile";
import type { MeasureFigure } from "@/lib/kpi/additional-kpi-figures";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import { NOT_AVAILABLE_TEXT, NO_DATA_TEXT, type AmountFigure } from "@/lib/kpi/kpi-figures";

/**
 * Words the additional KPIs for the tiles of the KPI dashboard (VI-F05-S02, R2, R13, E1, E4). The line
 * under a value is the formula of the KPI, as the design draws it. A figure that has nothing to count says
 * No data, one that has nothing stored says Not available: neither is a 0. Pure, no I/O.
 */

export const NO_READY_BOOKINGS_CAPTION = "No booking reached Ready in this period";
export const NO_INSTALLATIONS_CAPTION = "No installation was completed in this period";
export const NO_SEATS_CAPTION = "No seat is in service";

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** `5.2 d`, or `5 d` when the number is whole. */
const days = (value: number) => `${value} d`;

/** `24 min`, `1 h 5 min`; under a minute is `<1 min`, never 0. */
export function formatMinutes(value: number): string {
  const total = Math.round(value);

  if (total < 1) return "<1 min";
  if (total < 60) return `${total} min`;

  const minutes = total % 60;

  return minutes === 0 ? `${Math.floor(total / 60)} h` : `${Math.floor(total / 60)} h ${minutes} min`;
}

function measureTile(
  id: string,
  label: string,
  figure: MeasureFigure,
  options: { format: (value: number) => string; caption: string; noData: string },
): KpiTile {
  if (figure.state === "no_data") return { id, label, value: NO_DATA_TEXT, caption: options.noData };
  if (figure.state === "not_available") return { id, label, value: NOT_AVAILABLE_TEXT, caption: figure.reason };

  return { id, label, value: options.format(figure.value), caption: options.caption };
}

function revenueTile(figure: AmountFigure, period_label: string): KpiTile {
  const id = "monthly_partner_revenue";
  const label = "Monthly partner revenue";

  if (figure.state === "no_data") return { id, label, value: NO_DATA_TEXT, caption: NO_COMPLETED_RENTALS_CAPTION };
  if (figure.state === "not_available") return { id, label, value: NOT_AVAILABLE_TEXT, caption: figure.reason };

  return { id, label, value: usd(figure.amount), caption: joinCaption(`USD · ${period_label}`, commercialGapNote(figure)) };
}

/**
 * The nine tiles, in the order of the design. Monthly partner revenue is the commercial figure of the core
 * KPIs, so it is the same value as that tile for the same scope and period (E6).
 */
export function buildAdditionalKpiTiles(kpis: AdditionalKpis, commercial: AmountFigure, period_label: string): KpiTile[] {
  const { inventory_buffer: inventory, replacement_rate: replacement, refunds } = kpis;

  return [
    measureTile("seat_utilisation", "Seat utilisation", kpis.seat_utilisation, {
      format: (value) => `${value}%`,
      caption: "Rented seat-days / available seat-days",
      noData: NO_COMPLETED_RENTALS_CAPTION,
    }),
    measureTile("average_rental_duration", "Average rental duration", kpis.average_rental_duration, {
      format: days,
      caption: "Paid days / completed rentals",
      noData: NO_COMPLETED_RENTALS_CAPTION,
    }),
    inventory.state === "value"
      ? { id: "inventory_buffer", label: "Inventory buffer", value: String(inventory.seats), caption: `Available seats at ${inventory.airports}` }
      : { id: "inventory_buffer", label: "Inventory buffer", value: NO_DATA_TEXT, caption: NO_SEATS_CAPTION },
    replacement.state === "value"
      ? {
          id: "replacement_rate",
          label: "Replacement rate",
          value: `${replacement.percent}%`,
          caption: `${plural(replacement.replacements, "replacement")} / ${plural(replacement.rentals, "rental")}`,
        }
      : { id: "replacement_rate", label: "Replacement rate", value: NO_DATA_TEXT, caption: NO_COMPLETED_RENTALS_CAPTION },
    measureTile("average_preparation", "Average preparation", kpis.average_preparation, {
      format: formatMinutes,
      caption: "Preparation start to Ready",
      noData: NO_READY_BOOKINGS_CAPTION,
    }),
    measureTile("installation_time", "Installation time", kpis.installation_time, {
      format: formatMinutes,
      caption: "Install start to completed",
      noData: NO_INSTALLATIONS_CAPTION,
    }),
    refunds.state === "value"
      ? {
          id: "refunds",
          label: "Refunds",
          value: usd(refunds.amount),
          caption: `USD · ${plural(refunds.refunded_bookings, "refunded booking")}`,
        }
      : { id: "refunds", label: "Refunds", value: NO_DATA_TEXT, caption: NO_COMPLETED_RENTALS_CAPTION },
    { id: "complaints", label: "Complaints", value: NOT_AVAILABLE_TEXT, caption: kpis.complaints.reason },
    revenueTile(commercial, period_label),
  ];
}
