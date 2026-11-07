/**
 * What each KPI of the KPI dashboard is, in words (VI-F05-S03, spec R3, R8): its name, its formula in one line,
 * where the data comes from and a note. The screen reads this one list for the formula popover and for the
 * formula card, and the table of `docs/kpi-formulas.md` is checked against it, so a formula is written once.
 * An export or the assistant that shows a KPI reads the same list. Pure, no I/O.
 */

export type KpiId =
  | "correct_seat"
  | "family_ready_on_time"
  | "traceability"
  | "incidents"
  | "commercial"
  | "seat_utilisation"
  | "average_rental_duration"
  | "inventory_buffer"
  | "replacement_rate"
  | "average_preparation"
  | "installation_time"
  | "refunds"
  | "complaints"
  | "monthly_partner_revenue";

export interface KpiDefinition {
  id: KpiId;
  label: string;
  /** The formula in one line. */
  formula: string;
  /** The tables or records the figure is read from. */
  source: string;
  note: string;
}

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    id: "correct_seat",
    label: "Correct-seat fulfilment",
    formula: "Allocated seat installed ÷ completed bookings × 100",
    source: "Bookings and installation records (seat scan result)",
    note: "Excludes cancelled bookings and no-shows. Based on verified scan and installation records.",
  },
  {
    id: "family_ready_on_time",
    label: "Family Ready on time",
    formula: "Bookings Family Ready before their deadline ÷ bookings Family Ready × 100",
    source: "Bookings (Family Ready time) and installation job deadlines",
    note: "A booking with no stored deadline is left out of the rate.",
  },
  {
    id: "traceability",
    label: "Cleaning / inspection traceability",
    formula: "Completed bookings with a cleaning and an inspection record ÷ completed bookings × 100",
    source: "Bookings, cleaning records and inspection records",
    note: "A completed booking is returned, cleaning, inspection or completed, by return time. A missing record is a gap.",
  },
  {
    id: "incidents",
    label: "Operational incidents",
    formula: "Incidents linked to the completed bookings",
    source: "Incidents and bookings",
    note: "The percentage under the value is incidents per completed booking.",
  },
  {
    id: "commercial",
    label: "Commercial performance",
    formula: "Sum of the partner revenue share of the completed bookings",
    source: "Bookings (partner share)",
    note: "In USD. A booking with no calculated share is left out, not counted as 0.",
  },
  {
    id: "seat_utilisation",
    label: "Seat utilisation",
    formula: "Rented seat-days ÷ available seat-days × 100",
    source: "Bookings and seats",
    note: "Available seat-days count every seat in service in the period, at every airport. Rented seat-days are the rentals the viewer may see.",
  },
  {
    id: "average_rental_duration",
    label: "Average rental duration",
    formula: "Paid days ÷ completed rentals",
    source: "Bookings (paid days)",
    note: "In days.",
  },
  {
    id: "inventory_buffer",
    label: "Inventory buffer",
    formula: "Seats with status available now",
    source: "Seats and airports",
    note: "Counted at every airport. It does not depend on the period.",
  },
  {
    id: "replacement_rate",
    label: "Replacement rate",
    formula: "Seat replacements ÷ completed rentals × 100",
    source: "Booking events (seat changes)",
    note: "A first seat assignment, or a seat taken off with none put in its place, is not a replacement.",
  },
  {
    id: "average_preparation",
    label: "Average preparation",
    formula: "Average time from the first move to Preparation to the first move to Ready",
    source: "Booking events (status changes)",
    note: "A booking with no Preparation step is left out of the average.",
  },
  {
    id: "installation_time",
    label: "Installation time",
    formula: "Average time from install start to completed",
    source: "Technician jobs (installation)",
    note: "A job with no start time is left out of the average.",
  },
  {
    id: "refunds",
    label: "Refunds",
    formula: "Sum of the partial and full refunds of the completed bookings",
    source: "Booking adjustments",
    note: "In USD. Chargebacks and manual adjustments are not refunds.",
  },
  {
    id: "complaints",
    label: "Complaints",
    formula: "Complaints recorded in the period",
    source: "No source yet: no complaint record exists",
    note: "Shown as Not available until the PO confirms where complaints come from (spec Q3).",
  },
  {
    id: "monthly_partner_revenue",
    label: "Monthly partner revenue",
    formula: "Sum of the partner revenue share of the completed bookings",
    source: "Bookings (partner share)",
    note: "In USD. The same figure as Commercial performance for the same scope and period.",
  },
];

const BY_ID = new Map(KPI_DEFINITIONS.map((definition) => [definition.id, definition]));

/** The definition of a KPI. Every id of `KpiId` has one, so this never gives undefined. */
export function getKpiDefinition(id: KpiId): KpiDefinition {
  return BY_ID.get(id) as KpiDefinition;
}
