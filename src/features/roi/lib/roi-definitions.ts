/**
 * What each estimated line of the ROI dashboard is, in words (VI-F05-S06, spec R8): its name, its formula in
 * one line, where the figures come from and a note. The table "ROI estimate formulas" of
 * `docs/kpi-formulas.md` is checked against this list, so a formula is written once. They are a working
 * assumption until the PO answers spec Q2 and Q4. Pure, no I/O.
 */

export interface RoiDefinition {
  id: "avoided_handling" | "inventory_savings" | "conversion_value" | "avoided_costs" | "total_partner_value";
  label: string;
  formula: string;
  source: string;
  note: string;
}

export const ROI_DEFINITIONS: readonly RoiDefinition[] = [
  {
    id: "avoided_handling",
    label: "Avoided handling",
    formula: "Handling cost per rental × completed rentals",
    source: "Baseline inputs and completed bookings",
    note: "Estimate. The rentals are the verified rentals of the period.",
  },
  {
    id: "inventory_savings",
    label: "Inventory savings",
    formula: "(Monthly inventory cost − programme inventory cost) × months in the period",
    source: "Baseline inputs",
    note: "Estimate. Year to date counts the months so far this year, the current month included.",
  },
  {
    id: "conversion_value",
    label: "Conversion value",
    formula: "(Programme conversion − baseline conversion) × qualified enquiries × months × average contribution per rental",
    source: "Baseline inputs",
    note: "Estimate. The first part is the incremental rentals shown under the value.",
  },
  {
    id: "avoided_costs",
    label: "Estimated avoided costs",
    formula: "Avoided handling + inventory savings",
    source: "The two lines above",
    note: "Estimate. Conversion value is a separate card.",
  },
  {
    id: "total_partner_value",
    label: "Total partner value created",
    formula: "Verified partner revenue + avoided handling + inventory savings + conversion value",
    source: "Verified partner revenue and the three estimated lines",
    note: "Estimate. Onboarding and annual fees are not taken off yet (spec R6 is open). Not available when the verified revenue is not.",
  },
];
