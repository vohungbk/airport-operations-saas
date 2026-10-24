import { describe, expect, it } from "vitest";

import { createCommercialTermsSchema } from "@/features/partners/schemas/commercial-terms.schema";

const TODAY = "2026-10-24";
const schema = createCommercialTermsSchema(TODAY);

const valid = {
  partner_share_percent: 30,
  launch_partner_share_percent: 50,
  launch_credit_target: null,
  annual_fee: 0,
  onboarding_fee: 0,
  vat_rate_percent: 0,
  payment_terms_days: 14,
  effective_from: TODAY,
};

const messagesOf = (input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
};

describe("commercial terms schema", () => {
  it("should accept the default terms starting today", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["the lowest shares", { partner_share_percent: 0, launch_partner_share_percent: 0 }],
    ["the highest shares", { partner_share_percent: 100, launch_partner_share_percent: 100 }],
    ["a launch share equal to the partner share", { partner_share_percent: 40, launch_partner_share_percent: 40 }],
    ["two decimals", { partner_share_percent: 33.33, launch_partner_share_percent: 66.67 }],
    ["a date in the future", { effective_from: "2027-01-01" }],
    ["a launch target of zero", { launch_credit_target: 0 }],
    ["a launch target with cents", { launch_credit_target: 12345.67 }],
    ["the largest money amount", { annual_fee: 9_999_999_999.99, onboarding_fee: 9_999_999_999.99, launch_credit_target: 9_999_999_999.99 }],
    ["a VAT rate of 100", { vat_rate_percent: 100 }],
    ["payment terms of zero days", { payment_terms_days: 0 }],
    ["payment terms of 3650 days", { payment_terms_days: 3650 }],
  ])("should accept %s", (_name, change) => {
    expect(schema.safeParse({ ...valid, ...change }).success).toBe(true);
  });

  it.each([
    ["a partner share above 100", { partner_share_percent: 100.01 }, "partner_share_percent: The partner share must be from 0 to 100."],
    ["a negative partner share", { partner_share_percent: -1 }, "partner_share_percent: The partner share must be from 0 to 100."],
    ["a partner share with 3 decimals", { partner_share_percent: 30.001 }, "partner_share_percent: The partner share can have at most 2 decimals."],
    ["a missing partner share", { partner_share_percent: Number.NaN }, "partner_share_percent: The partner share is required."],
    ["a launch share above 100", { launch_partner_share_percent: 101 }, "launch_partner_share_percent: The launch partner share must be from 0 to 100."],
    ["a launch share below the partner share", { partner_share_percent: 40, launch_partner_share_percent: 39.99 }, "launch_partner_share_percent: The launch partner share cannot be below the partner share."],
    ["a missing launch share", { launch_partner_share_percent: undefined }, "launch_partner_share_percent: The launch partner share is required."],
    ["a date in the past", { effective_from: "2026-10-23" }, "effective_from: The effective date cannot be in the past."],
    ["a date that is not a date", { effective_from: "tomorrow" }, "effective_from: Enter a valid effective date."],
  ])("should refuse %s with a clear message", (_name, change, message) => {
    expect(messagesOf({ ...valid, ...change })).toContain(message);
  });

  it.each([
    ["a negative launch target", { launch_credit_target: -0.01 }, "launch_credit_target: The launch credit target must be zero or more."],
    ["a launch target with 3 decimals", { launch_credit_target: 1.001 }, "launch_credit_target: The launch credit target can have at most 2 decimals."],
    ["a launch target too large", { launch_credit_target: 10_000_000_000 }, "launch_credit_target: The launch credit target is too large."],
    ["a negative annual fee", { annual_fee: -1 }, "annual_fee: The annual programme fee must be zero or more."],
    ["an annual fee with 3 decimals", { annual_fee: 0.005 }, "annual_fee: The annual programme fee can have at most 2 decimals."],
    ["a missing annual fee", { annual_fee: Number.NaN }, "annual_fee: The annual programme fee is required."],
    ["a negative onboarding credit", { onboarding_fee: -5 }, "onboarding_fee: The onboarding credit must be zero or more."],
    ["a missing onboarding credit", { onboarding_fee: undefined }, "onboarding_fee: The onboarding credit is required."],
    ["a VAT rate above 100", { vat_rate_percent: 100.01 }, "vat_rate_percent: The VAT rate must be from 0 to 100."],
    ["a negative VAT rate", { vat_rate_percent: -1 }, "vat_rate_percent: The VAT rate must be from 0 to 100."],
    ["payment terms with a decimal", { payment_terms_days: 14.5 }, "payment_terms_days: The payment terms must be a whole number of days."],
    ["negative payment terms", { payment_terms_days: -1 }, "payment_terms_days: The payment terms must be zero or more days."],
    ["payment terms above 3650 days", { payment_terms_days: 3651 }, "payment_terms_days: The payment terms can be at most 3650 days."],
    ["missing payment terms", { payment_terms_days: Number.NaN }, "payment_terms_days: The payment terms are required."],
  ])("should refuse %s with a clear message (VI-F04-S02)", (_name, change, message) => {
    expect(messagesOf({ ...valid, ...change })).toContain(message);
  });

  it("should refuse a share sent as text", () => {
    expect(schema.safeParse({ ...valid, partner_share_percent: "30" }).success).toBe(false);
  });
});
