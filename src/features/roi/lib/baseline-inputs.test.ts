import { describe, expect, it } from "vitest";

import {
  BASELINE_FIELDS,
  BASELINE_SECTIONS,
  baselineLabel,
  baselineStep,
  baselineSubtitle,
  baselineValuesOf,
  toBaselineRpcArgs,
  type BaselineValues,
} from "@/features/roi/lib/baseline-inputs";

const VALUES = Object.fromEntries(BASELINE_FIELDS.map((field, index) => [field.name, index + 1])) as BaselineValues;

describe("the fields of the Baseline inputs screen (VI-F05-S05, AC01)", () => {
  it("should draw the three groups in the order of the design", () => {
    expect(BASELINE_SECTIONS.map((section) => section.title)).toEqual([
      "Current costs",
      "Inventory and handling",
      "Pricing and conversion",
    ]);
  });

  it("should draw the labels of the design, with the unit after the title", () => {
    expect(BASELINE_SECTIONS.map((section) => section.fields.map(baselineLabel))).toEqual([
      ["Monthly staff cost · USD", "Handling cost per rental · USD", "Monthly inventory cost · USD", "Programme inventory cost · USD"],
      ["Owned seats", "Average handling minutes", "Hourly staff cost · USD", "Expected programme handling minutes"],
      [
        "Average daily price · USD",
        "Average paid days",
        "Baseline conversion · %",
        "Programme conversion · %",
        "Qualified enquiries",
        "Average contribution per rental · USD",
      ],
    ]);
  });

  it("should have 14 fields, each one once", () => {
    expect(BASELINE_FIELDS).toHaveLength(14);
    expect(new Set(BASELINE_FIELDS.map((field) => field.name)).size).toBe(14);
  });

  it("should step a count by 1 and the other numbers by 0.01", () => {
    const step = (name: string) => baselineStep(BASELINE_FIELDS.find((field) => field.name === name)!);

    expect(step("owned_seats")).toBe("1");
    expect(step("qualified_enquiries")).toBe("1");
    expect(step("monthly_staff_cost")).toBe("0.01");
    expect(step("baseline_conversion_percent")).toBe("0.01");
  });

  it("should name the partner in the line under the title", () => {
    expect(baselineSubtitle("Emirates Rent A Car")).toBe("Emirates Rent A Car · Assumptions for estimated business value only");
  });
});

describe("toBaselineRpcArgs", () => {
  it("should send every field with the prefix p_, and nothing else", () => {
    const args = toBaselineRpcArgs(VALUES);

    expect(Object.keys(args).sort()).toEqual(BASELINE_FIELDS.map((field) => `p_${field.name}`).sort());
    expect(args).toMatchObject({ p_monthly_staff_cost: 1, p_average_contribution_per_rental: 14 });
  });

  it("should never carry a partner, because the database takes it from the caller", () => {
    expect(Object.keys(toBaselineRpcArgs(VALUES))).not.toContain("p_partner_id");
  });
});

describe("baselineValuesOf", () => {
  it("should keep the fields of the screen and drop the columns that are not on it", () => {
    const row = { ...VALUES, partner_id: "p-1", created_at: "x", updated_at: "y", updated_by: "u-1" };

    expect(baselineValuesOf(row)).toEqual(VALUES);
  });
});
