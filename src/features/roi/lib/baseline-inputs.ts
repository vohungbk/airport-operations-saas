import type { Database } from "@/types/database.types";

/**
 * The fields of the Baseline inputs screen (VI-F05-S05, F2 to F4), in the order and with the names the
 * design draws them (frame G3). Pure, no I/O. The saved row is the source of the field names, so a field
 * cannot be on the screen and missing from the table.
 */

type BaselineRow = Database["public"]["Tables"]["partner_baseline_inputs"]["Row"];

export type BaselineFieldName = Exclude<keyof BaselineRow, "partner_id" | "created_at" | "updated_at" | "updated_by">;

/** The values of the form: one number per field. */
export type BaselineValues = Record<BaselineFieldName, number>;

/** `amount`: zero or more, 2 decimals. `count`: a whole number, zero or more. `percent`: from 0 to 100, 2 decimals. */
export type BaselineFieldKind = "amount" | "count" | "percent";

export interface BaselineField {
  name: BaselineFieldName;
  title: string;
  /** The unit written after the title, such as `USD` or `%`. */
  unit?: string;
  kind: BaselineFieldKind;
}

export interface BaselineSection {
  id: "current_costs" | "inventory_and_handling" | "pricing_and_conversion";
  title: string;
  fields: readonly BaselineField[];
}

export const BASELINE_SECTIONS: readonly BaselineSection[] = [
  {
    id: "current_costs",
    title: "Current costs",
    fields: [
      { name: "monthly_staff_cost", title: "Monthly staff cost", unit: "USD", kind: "amount" },
      { name: "handling_cost_per_rental", title: "Handling cost per rental", unit: "USD", kind: "amount" },
      { name: "monthly_inventory_cost", title: "Monthly inventory cost", unit: "USD", kind: "amount" },
      { name: "programme_inventory_cost", title: "Programme inventory cost", unit: "USD", kind: "amount" },
    ],
  },
  {
    id: "inventory_and_handling",
    title: "Inventory and handling",
    fields: [
      { name: "owned_seats", title: "Owned seats", kind: "count" },
      { name: "average_handling_minutes", title: "Average handling minutes", kind: "amount" },
      { name: "hourly_staff_cost", title: "Hourly staff cost", unit: "USD", kind: "amount" },
      { name: "expected_programme_handling_minutes", title: "Expected programme handling minutes", kind: "amount" },
    ],
  },
  {
    id: "pricing_and_conversion",
    title: "Pricing and conversion",
    fields: [
      { name: "average_daily_price", title: "Average daily price", unit: "USD", kind: "amount" },
      { name: "average_paid_days", title: "Average paid days", kind: "amount" },
      { name: "baseline_conversion_percent", title: "Baseline conversion", unit: "%", kind: "percent" },
      { name: "programme_conversion_percent", title: "Programme conversion", unit: "%", kind: "percent" },
      { name: "qualified_enquiries", title: "Qualified enquiries", kind: "count" },
      { name: "average_contribution_per_rental", title: "Average contribution per rental", unit: "USD", kind: "amount" },
    ],
  },
];

export const BASELINE_FIELDS: readonly BaselineField[] = BASELINE_SECTIONS.flatMap((section) => section.fields);

/** The label above a control, as the design writes it: `Monthly staff cost · USD`. */
export function baselineLabel(field: BaselineField): string {
  return field.unit ? `${field.title} · ${field.unit}` : field.title;
}

/** The `step` of the number input of a field. */
export const baselineStep = (field: BaselineField): string => (field.kind === "count" ? "1" : "0.01");

export const BASELINE_TITLE = "Baseline inputs";
export const BASELINE_NOTE = "Used only in estimated business value. Save an updated version to preserve a comparable history.";
export const BASELINE_SAVE_LABEL = "Save baseline version";
export const BASELINE_DISCARD_LABEL = "Discard changes";
export const EDIT_BASELINE_LABEL = "Edit baseline inputs";

/** The line under the title: who the baseline is for. */
export const baselineSubtitle = (partner_name: string): string => `${partner_name} · Assumptions for estimated business value only`;

/** The saved values of a row, without the columns that are not on the screen. */
export function baselineValuesOf(row: Pick<BaselineRow, BaselineFieldName>): BaselineValues {
  return Object.fromEntries(BASELINE_FIELDS.map(({ name }) => [name, row[name]])) as BaselineValues;
}

/**
 * The arguments of the `save_partner_baseline_inputs` function: every field with the prefix `p_`. The call
 * site hands them to `supabase.rpc`, which checks them against the generated types, so a renamed column or
 * argument fails the build instead of the save.
 */
export type BaselineRpcArgs = { [K in BaselineFieldName as `p_${K}`]: number };

export function toBaselineRpcArgs(values: BaselineValues): BaselineRpcArgs {
  return Object.fromEntries(BASELINE_FIELDS.map(({ name }) => [`p_${name}`, values[name]])) as BaselineRpcArgs;
}
