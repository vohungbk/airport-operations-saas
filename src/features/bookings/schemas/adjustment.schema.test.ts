import { describe, expect, it } from "vitest";

import { createAdjustmentSchema } from "@/features/bookings/schemas/adjustment.schema";

const MAX = 450;
const schema = createAdjustmentSchema(MAX);

const valid = { type: "partial_refund", amount: 50, reason: "The harness was worn" };

const messagesOf = (input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("adjustment schema (VI-F04-S10 V7 to V9)", () => {
  it("should accept a valid adjustment", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(["partial_refund", "full_refund", "manual_adjustment", "chargeback"])("should accept the type %s (AC03)", (type) => {
    expect(schema.safeParse({ ...valid, type }).success).toBe(true);
  });

  it.each([
    ["a missing type", { type: undefined }, "type: Choose the type of adjustment."],
    ["a type that is not in the list", { type: "bonus" }, "type: Choose the type of adjustment."],
    ["an empty type", { type: "" }, "type: Choose the type of adjustment."],
  ])("should refuse %s with a clear message (AC03)", (_name, change, message) => {
    expect(messagesOf({ ...valid, ...change })).toContain(message);
  });

  it.each([
    ["the smallest amount", 0.01],
    ["an amount with cents", 12.34],
    ["exactly the gross revenue", MAX],
  ])("should accept %s (AC04)", (_name, amount) => {
    expect(schema.safeParse({ ...valid, amount }).success).toBe(true);
  });

  it.each([
    ["zero", { amount: 0 }, "amount: The amount must be above zero."],
    ["negative", { amount: -5 }, "amount: The amount must be above zero."],
    ["with 3 decimals", { amount: 10.005 }, "amount: The amount can have at most 2 decimals."],
    ["a cent above the gross revenue", { amount: 450.01 }, "amount: The amount cannot be above the gross revenue of the booking (450.00)."],
    ["not a number", { amount: Number.NaN }, "amount: Enter the amount."],
    ["missing", { amount: undefined }, "amount: Enter the amount."],
  ])("should refuse an amount that is %s with a clear message (AC04, E6, E7)", (_name, change, message) => {
    expect(messagesOf({ ...valid, ...change })).toContain(message);
  });

  it("should refuse an amount sent as text", () => {
    expect(schema.safeParse({ ...valid, amount: "50" }).success).toBe(false);
  });

  it("should check the amount against the gross revenue it was given: what is left after earlier adjustments", () => {
    expect(createAdjustmentSchema(50).safeParse({ ...valid, amount: 50 }).success).toBe(true);
    expect(createAdjustmentSchema(50).safeParse({ ...valid, amount: 50.01 }).success).toBe(false);
  });

  it.each([
    ["empty", { reason: "" }],
    ["only spaces", { reason: "     " }],
    ["missing", { reason: undefined }],
  ])("should refuse a reason that is %s with a clear message (AC05)", (_name, change) => {
    expect(messagesOf({ ...valid, ...change })).toContain("reason: Enter the reason.");
  });

  it("should accept a reason of 1000 characters and refuse one of 1001 (AC05)", () => {
    expect(schema.safeParse({ ...valid, reason: "x".repeat(1000) }).success).toBe(true);
    expect(messagesOf({ ...valid, reason: "x".repeat(1001) })).toContain("reason: The reason can have at most 1000 characters.");
  });

  it("should trim the reason", () => {
    const result = schema.safeParse({ ...valid, reason: "  Worn  " });

    expect(result.success && result.data.reason).toBe("Worn");
  });
});
