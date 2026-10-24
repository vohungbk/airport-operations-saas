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
    expect(pickCommercialTerms([], "2026-10-24")).toEqual({ current: null, upcoming: [] });
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

  it("should have no current version before the first one starts", () => {
    const picked = pickCommercialTerms([version("first", "2026-12-01")], "2026-10-24");

    expect(picked.current).toBeNull();
    expect(picked.upcoming).toHaveLength(1);
  });
});

describe("defaultCommercialTermsFormValues", () => {
  it("should start a partner with no terms at 30 and 50, from today", () => {
    expect(defaultCommercialTermsFormValues([], "2026-10-24")).toEqual({
      partner_share_percent: 30,
      launch_partner_share_percent: 50,
      effective_from: "2026-10-24",
    });
  });

  it("should start from the shares of the latest version, from today when it has started", () => {
    const latest = { ...version("a", "2026-01-01"), partner_share_percent: 40, launch_partner_share_percent: 60 };

    expect(defaultCommercialTermsFormValues([version("old", "2025-01-01", "2025-12-31"), latest], "2026-10-24")).toEqual({
      partner_share_percent: 40,
      launch_partner_share_percent: 60,
      effective_from: "2026-10-24",
    });
  });

  it("should start the day after a version that begins today or later, since the database needs a later date", () => {
    expect(defaultCommercialTermsFormValues([version("a", "2026-10-24")], "2026-10-24").effective_from).toBe("2026-10-25");
    expect(defaultCommercialTermsFormValues([version("a", "2026-12-31")], "2026-10-24").effective_from).toBe("2027-01-01");
  });
});
