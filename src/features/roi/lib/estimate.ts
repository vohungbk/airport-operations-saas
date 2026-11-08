import type { BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { toCents } from "@/lib/money/money";

/**
 * The estimated business value of a partner (VI-F05-S06, spec R5, R6, R10). Every figure is modelled from the
 * saved baseline and the verified rentals of the period; none of it is cash or recognised revenue, and an
 * estimate is never added to a verified figure other than in the one total that says so. The formulas are
 * written in `roi-definitions.ts` and in `docs/kpi-formulas.md` (R8). They are the working assumption of this
 * story: spec Q2 (how each avoided cost is calculated) and Q4 (calendar rules) are still open. Pure, no I/O.
 */

export interface EstimateInput {
  /** The completed rentals of the period. */
  rentals: number;
  /** How many months the period covers: 1 for a month, the months so far for year to date. */
  months: number;
  /** The verified partner revenue of the period; `null` when it is not available. */
  verified_revenue: number | null;
}

export interface EstimateBreakdownRow {
  id: "staff_handling" | "owned_inventory" | "customer_conversion";
  baseline: number;
  scenario: number;
  estimated: number;
}

export interface Estimate {
  avoided_handling: number;
  inventory_savings: number;
  conversion_value: number;
  /** The rentals the programme adds, from the conversion gain on the enquiries. */
  incremental_rentals: number;
  /** Avoided handling plus inventory savings. */
  avoided_costs: number;
  /** The verified partner revenue of the period, as it was given; `null` when it is not available. */
  verified_revenue: number | null;
  /** Verified partner revenue plus every estimated line; `null` when the revenue is not available. */
  total_partner_value: number | null;
  breakdown: EstimateBreakdownRow[];
}

/** Whole cents, so a sum of money does not carry the noise of a float (0.1 + 0.2). */
const roundMoney = (value: number): number => toCents(value) / 100;

export function calculateEstimate(baseline: BaselineValues, input: EstimateInput): Estimate {
  const { rentals, months, verified_revenue } = input;

  const avoided_handling = roundMoney(baseline.handling_cost_per_rental * rentals);
  const inventory_savings = roundMoney((baseline.monthly_inventory_cost - baseline.programme_inventory_cost) * months);
  const incremental_rentals = roundMoney(
    ((baseline.programme_conversion_percent - baseline.baseline_conversion_percent) / 100) * baseline.qualified_enquiries * months,
  );
  const conversion_value = roundMoney(incremental_rentals * baseline.average_contribution_per_rental);
  const avoided_costs = roundMoney(avoided_handling + inventory_savings);
  const estimated_lines = roundMoney(avoided_costs + conversion_value);
  const staff_cost = roundMoney(baseline.monthly_staff_cost * months);

  return {
    avoided_handling,
    inventory_savings,
    conversion_value,
    incremental_rentals,
    avoided_costs,
    verified_revenue,
    total_partner_value: verified_revenue === null ? null : roundMoney(verified_revenue + estimated_lines),
    breakdown: [
      { id: "staff_handling", baseline: staff_cost, scenario: roundMoney(staff_cost - avoided_handling), estimated: avoided_handling },
      {
        id: "owned_inventory",
        baseline: roundMoney(baseline.monthly_inventory_cost * months),
        scenario: roundMoney(baseline.programme_inventory_cost * months),
        estimated: inventory_savings,
      },
      { id: "customer_conversion", baseline: 0, scenario: conversion_value, estimated: conversion_value },
    ],
  };
}
