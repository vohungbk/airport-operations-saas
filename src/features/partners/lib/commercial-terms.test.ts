import { describe, expect, it } from "vitest";

import {
  dayAfter,
  defaultCommercialTermsFormValues,
  pickCommercialTerms,
  platformShareOf,
  utcToday,
  type CommercialTermsVersion,
} from "@/features/partners/lib/commercial-terms";

const version = (id: string, from: string, to: string | null = null): CommercialTermsVersion => ({
  id,
  partner_share_percent: 30,
  platform_share_percent: 70,
  launch_partner_share_percent: 50,
  launch_credit_target: null,
  annual_fee: 0,
  onboarding_fee: 0,
  vat_rate_percent: 0,
  payment_terms_days: 14,
  effective_from: from,
  effective_to: to,
});

describe("utcToday", () => {
  it("should give the date in UTC, not in the local time zone", () => {
    expect(utcToday(new Date("2026-10-24T23:59:59Z"))).toBe("2026-10-24");
    expect(utcToday(new Date("2026-10-25T00:00:00Z"))).toBe("2026-10-25");
  });
});

describe("dayAfter", () => {
  it.each([
    ["2026-10-24", "2026-10-25"],
    ["2026-10-31", "2026-11-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"],
  ])("should give %s -> %s", (date, next) => {
    expect(dayAfter(date)).toBe(next);
  });
});

describe("platformShareOf", () => {
  it.each([
    [30, 70],
    [0, 100],
    [100, 0],
    [35.5, 64.5],
    [33.33, 66.67],
  ])("should give %s for the partner share %s", (partner, platform) => {
    expect(platformShareOf(partner)).toBe(platform);
  });
});

describe("pickCommercialTerms", () => {
  it("should give nothing for a partner with no terms", () => {
    expect(pickCommercialTerms([], "2026-10-24")).toEqual({ current: null, upcoming: [], earlier: [] });
  });

  it("should pick the version in force, the start and the end day included", () => {
    const versions = [version("old", "2026-01-01", "2026-10-23"), version("now", "2026-10-24")];

    expect(pickCommercialTerms(versions, "2026-10-23").current?.id).toBe("old");
    expect(pickCommercialTerms(versions, "2026-10-24").current?.id).toBe("now");
  });

  it("should list the versions that have not started, soonest first, and not call them current", () => {
    const versions = [version("later", "2027-02-01"), version("soon", "2026-11-01"), version("now", "2026-01-01", "2026-10-31")];

    const picked = pickCommercialTerms(versions, "2026-10-24");

    expect(picked.current?.id).toBe("now");
    expect(picked.upcoming.map((v) => v.id)).toEqual(["soon", "later"]);
  });

  it("should list the versions that have ended as earlier, newest first (VI-F04-S03 AC01)", () => {
    const versions = [
      version("first", "2025-01-01", "2025-12-31"),
      version("second", "2026-01-01", "2026-06-30"),
      version("now", "2026-07-01"),
    ];

    const picked = pickCommercialTerms(versions, "2026-10-24");

    expect(picked.earlier.map((v) => v.id)).toEqual(["second", "first"]);
    expect(picked.current?.id).toBe("now");
  });

  it("should not call a version earlier on its last day, only the day after", () => {
    const versions = [version("old", "2026-01-01", "2026-10-24"), version("next", "2026-10-25")];

    expect(pickCommercialTerms(versions, "2026-10-24").earlier).toEqual([]);
    expect(pickCommercialTerms(versions, "2026-10-24").current?.id).toBe("old");
    expect(pickCommercialTerms(versions, "2026-10-25").earlier.map((v) => v.id)).toEqual(["old"]);
  });

  it("should not call a version that has not started earlier", () => {
    expect(pickCommercialTerms([version("later", "2027-01-01")], "2026-10-24").earlier).toEqual([]);
  });

  it("should give the terms of a rental for the day it was completed: completed rentals keep earlier terms, new terms apply from the effective date (VI-F04-S03 AC02)", () => {
    const old = { ...version("old", "2026-01-01", "2026-10-31"), partner_share_percent: 30 };
    const fresh = { ...version("new", "2026-11-01"), partner_share_percent: 40 };

    expect(pickCommercialTerms([old, fresh], "2026-10-31").current?.partner_share_percent).toBe(30);
    expect(pickCommercialTerms([old, fresh], "2026-11-01").current?.partner_share_percent).toBe(40);
    expect(pickCommercialTerms([old, fresh], "2025-12-31").current).toBeNull();
  });

  it("should have no current version before the first one starts", () => {
    const picked = pickCommercialTerms([version("first", "2026-12-01")], "2026-10-24");

    expect(picked.current).toBeNull();
    expect(picked.upcoming).toHaveLength(1);
  });
});

describe("defaultCommercialTermsFormValues", () => {
  it("should start a partner with no terms at 30 and 50, no target, no fees, no VAT and 14 days, from today", () => {
    expect(defaultCommercialTermsFormValues([], "2026-10-24")).toEqual({
      partner_share_percent: 30,
      launch_partner_share_percent: 50,
      launch_credit_target: null,
      annual_fee: 0,
      onboarding_fee: 0,
      vat_rate_percent: 0,
      payment_terms_days: 14,
      effective_from: "2026-10-24",
    });
  });

  it("should start from the shares of the latest version, from today when it has started", () => {
    const latest = {
      ...version("a", "2026-01-01"),
      partner_share_percent: 40,
      launch_partner_share_percent: 60,
      launch_credit_target: 5000,
      annual_fee: 1200,
      onboarding_fee: 300,
      vat_rate_percent: 20,
      payment_terms_days: 30,
    };

    expect(defaultCommercialTermsFormValues([version("old", "2025-01-01", "2025-12-31"), latest], "2026-10-24")).toEqual({
      partner_share_percent: 40,
      launch_partner_share_percent: 60,
      launch_credit_target: 5000,
      annual_fee: 1200,
      onboarding_fee: 300,
      vat_rate_percent: 20,
      payment_terms_days: 30,
      effective_from: "2026-10-24",
    });
  });

  it("should start the day after a version that begins today or later, since the database needs a later date", () => {
    expect(defaultCommercialTermsFormValues([version("a", "2026-10-24")], "2026-10-24").effective_from).toBe("2026-10-25");
    expect(defaultCommercialTermsFormValues([version("a", "2026-12-31")], "2026-10-24").effective_from).toBe("2027-01-01");
  });
});
