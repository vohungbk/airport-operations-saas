import { describe, expect, it } from "vitest";

import {
  createSeatCategorySchema,
  setSeatCategoryActiveSchema,
  updateSeatCategorySchema,
} from "@/features/seat-categories/schemas/seat-category.schema";

const VALID_CREATE_INPUT = {
  name: "Infant Carrier",
  description: "Rear-facing seat",
  min_child_age: 0,
  max_child_age: 12,
  safety_standard: "ECE R129",
  is_active: true,
};

const VALID_UPDATE_INPUT = {
  name: "Infant Carrier",
  description: "Rear-facing seat",
  min_child_age: 0,
  max_child_age: 12,
  safety_standard: "ECE R129",
};

describe("createSeatCategorySchema", () => {
  it("should parse a valid input", () => {
    expect(createSeatCategorySchema.safeParse(VALID_CREATE_INPUT).success).toBe(
      true,
    );
  });

  it("should trim the name", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: "  Booster  ",
    });

    expect(result.success && result.data.name).toBe("Booster");
  });

  it("should convert an empty description to null", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      description: "   ",
    });

    expect(result.success && result.data.description).toBeNull();
  });

  it("should accept a missing description", () => {
    const withoutDescription: Record<string, unknown> = {
      ...VALID_CREATE_INPUT,
    };
    delete withoutDescription.description;

    const result = createSeatCategorySchema.safeParse(withoutDescription);

    expect(result.success && result.data.description).toBeNull();
  });

  it("should reject a description longer than 500 characters", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      description: "a".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it.each(["name", "safety_standard", "min_child_age", "max_child_age"])(
    "should reject input when %s is missing",
    (field) => {
      const input: Record<string, unknown> = { ...VALID_CREATE_INPUT };
      delete input[field];

      expect(createSeatCategorySchema.safeParse(input).success).toBe(false);
    },
  );

  it("should reject a name shorter than 2 characters", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      name: "a",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a blank safety standard", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      safety_standard: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a negative age", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      min_child_age: -1,
    });

    expect(result.success).toBe(false);
  });

  it("should reject a non-integer age", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      max_child_age: 12.5,
    });

    expect(result.success).toBe(false);
  });

  it("should reject NaN age (an empty number input)", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      min_child_age: Number.NaN,
    });

    expect(result.success).toBe(false);
  });

  it("should reject an age above the 216-month ceiling", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      max_child_age: 217,
    });

    expect(result.success).toBe(false);
  });

  it("should reject max age below min age and report it on max_child_age", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      min_child_age: 24,
      max_child_age: 12,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["max_child_age"]);
    }
  });

  it("should accept min age equal to max age", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      min_child_age: 12,
      max_child_age: 12,
    });

    expect(result.success).toBe(true);
  });

  it("should accept the boundary values 0 and 216", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      min_child_age: 0,
      max_child_age: 216,
    });

    expect(result.success).toBe(true);
  });

  it("should reject a non-boolean is_active", () => {
    const result = createSeatCategorySchema.safeParse({
      ...VALID_CREATE_INPUT,
      is_active: "yes",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateSeatCategorySchema", () => {
  it("should parse a valid input", () => {
    expect(updateSeatCategorySchema.safeParse(VALID_UPDATE_INPUT).success).toBe(
      true,
    );
  });

  it("should strip id and is_active so they can never be updated", () => {
    const result = updateSeatCategorySchema.safeParse({
      ...VALID_UPDATE_INPUT,
      id: "attacker-id",
      is_active: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("id");
      expect(result.data).not.toHaveProperty("is_active");
    }
  });

  it("should reject max age below min age", () => {
    const result = updateSeatCategorySchema.safeParse({
      ...VALID_UPDATE_INPUT,
      min_child_age: 10,
      max_child_age: 5,
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing name", () => {
    const withoutName: Record<string, unknown> = { ...VALID_UPDATE_INPUT };
    delete withoutName.name;

    expect(updateSeatCategorySchema.safeParse(withoutName).success).toBe(false);
  });
});

describe("setSeatCategoryActiveSchema", () => {
  it("should parse a valid input", () => {
    const result = setSeatCategoryActiveSchema.safeParse({
      seat_category_id: "b0000000-0000-4000-8000-000000000001",
      is_active: false,
    });

    expect(result.success).toBe(true);
  });

  it("should reject a non-uuid id", () => {
    const result = setSeatCategoryActiveSchema.safeParse({
      seat_category_id: "nope",
      is_active: false,
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing is_active", () => {
    const result = setSeatCategoryActiveSchema.safeParse({
      seat_category_id: "b0000000-0000-4000-8000-000000000001",
    });

    expect(result.success).toBe(false);
  });
});
