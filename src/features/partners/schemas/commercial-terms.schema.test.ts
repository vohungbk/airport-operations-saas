import { describe, expect, it } from "vitest";

import { createCommercialTermsSchema } from "@/features/partners/schemas/commercial-terms.schema";

const TODAY = "2026-10-24";
const schema = createCommercialTermsSchema(TODAY);

const valid = {
  partner_share_percent: 30,
  launch_partner_share_percent: 50,
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

  it("should refuse a share sent as text", () => {
    expect(schema.safeParse({ ...valid, partner_share_percent: "30" }).success).toBe(false);
  });
});
