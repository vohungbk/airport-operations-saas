import { describe, expect, it } from "vitest";

import { BASELINE_FIELDS, type BaselineValues } from "@/features/roi/lib/baseline-inputs";
import { baselineInputsSchema } from "@/features/roi/schemas/baseline-inputs.schema";

const VALID: BaselineValues = {
  monthly_staff_cost: 2400,
  handling_cost_per_rental: 5,
  monthly_inventory_cost: 1500,
  programme_inventory_cost: 700,
  owned_seats: 40,
  average_handling_minutes: 20,
  hourly_staff_cost: 15,
  expected_programme_handling_minutes: 10,
  average_daily_price: 20,
  average_paid_days: 5,
  baseline_conversion_percent: 12,
  programme_conversion_percent: 15,
  qualified_enquiries: 1000,
  average_contribution_per_rental: 50,
};

const messageOf = (change: Record<string, unknown>) => {
  const result = baselineInputsSchema.safeParse({ ...VALID, ...change });

  return result.success ? null : result.error.issues[0].message;
};

describe("baselineInputsSchema (VI-F05-S05, AC03 to AC05)", () => {
  it("should accept the values of the design", () => {
    expect(baselineInputsSchema.safeParse(VALID).success).toBe(true);
  });

  it("should accept zero in every field, and the ends of the conversion range", () => {
    const zeros = Object.fromEntries(BASELINE_FIELDS.map((field) => [field.name, 0]));

    expect(baselineInputsSchema.safeParse(zeros).success).toBe(true);
    expect(baselineInputsSchema.safeParse({ ...VALID, baseline_conversion_percent: 100 }).success).toBe(true);
  });

  it("should know every field of the screen, and no other", () => {
    expect(Object.keys(baselineInputsSchema.shape).sort()).toEqual(BASELINE_FIELDS.map((field) => field.name).sort());
  });

  it("should reject a negative current cost with a clear message (AC03)", () => {
    expect(messageOf({ monthly_staff_cost: -1 })).toBe("Monthly staff cost must be zero or more.");
  });

  it("should reject a current cost with more than 2 decimals, so the amount stays exact (AC03)", () => {
    expect(messageOf({ handling_cost_per_rental: 5.005 })).toBe("Handling cost per rental can have at most 2 decimals.");
  });

  it("should reject a current cost that does not fit the column (AC03)", () => {
    expect(messageOf({ monthly_inventory_cost: 10_000_000_000 })).toBe("Monthly inventory cost is too large.");
  });

  it.each([
    ["a missing value", undefined],
    ["a value that is not a number", Number.NaN],
    ["a value sent as text", "12"],
  ])("should reject %s as required (E3)", (_name, value) => {
    expect(messageOf({ programme_inventory_cost: value })).toBe("Programme inventory cost is required.");
  });

  it("should reject a negative number of owned seats (AC04)", () => {
    expect(messageOf({ owned_seats: -1 })).toBe("Owned seats must be zero or more.");
  });

  it("should reject a number of seats that is not whole (AC04)", () => {
    expect(messageOf({ owned_seats: 40.5 })).toBe("Owned seats must be a whole number.");
  });

  it("should reject negative handling minutes and a negative hourly cost (AC04)", () => {
    expect(messageOf({ average_handling_minutes: -0.5 })).toBe("Average handling minutes must be zero or more.");
    expect(messageOf({ hourly_staff_cost: -15 })).toBe("Hourly staff cost must be zero or more.");
  });

  it.each([
    ["above 100", 100.01],
    ["below 0", -0.01],
  ])("should reject a conversion %s (AC05)", (_name, value) => {
    expect(messageOf({ programme_conversion_percent: value })).toBe("Programme conversion must be from 0 to 100.");
  });

  it("should reject a conversion with more than 2 decimals (AC05)", () => {
    expect(messageOf({ baseline_conversion_percent: 12.345 })).toBe("Baseline conversion can have at most 2 decimals.");
  });

  it("should reject a negative price, a negative number of enquiries and a negative contribution (AC05)", () => {
    expect(messageOf({ average_daily_price: -20 })).toBe("Average daily price must be zero or more.");
    expect(messageOf({ qualified_enquiries: -1 })).toBe("Qualified enquiries must be zero or more.");
    expect(messageOf({ average_contribution_per_rental: -50 })).toBe("Average contribution per rental must be zero or more.");
  });

  it("should not say that a price above 100 is wrong, because only a conversion is a percent (AC05)", () => {
    expect(baselineInputsSchema.safeParse({ ...VALID, average_daily_price: 250, average_contribution_per_rental: 500 }).success).toBe(true);
  });
});
