import { describe, expect, it } from "vitest";

import { buildBookingRevenue, formatMoney, formatUsd, type RevenueLine } from "@/features/bookings/lib/booking-revenue";
import type { BookingRevenueRow } from "@/features/bookings/lib/get-booking-revenue";

const row = (overrides: Partial<BookingRevenueRow> = {}): BookingRevenueRow => ({
  id: "b-1",
  booking_number: "BK-00001",
  status: "completed",
  daily_rate: 20,
  paid_days: 6,
  rental_days: 8,
  gross_revenue: 100,
  adjustments_total: -20,
  partner_share: 60,
  platform_share: 40,
  launch_credit: 0,
  launch_credit_balance: null,
  revenue_case: "standard",
  revenue_flag: null,
  terms: {
    partner_share_percent: 60,
    platform_share_percent: 40,
    launch_partner_share_percent: 50,
    effective_from: "2026-01-01",
  },
  ...overrides,
});

const adjustments = [
  { type: "partial_refund", amount: 20 },
  { type: "manual_adjustment", amount: 10 },
  { type: "chargeback", amount: 10 },
] as const;

const card = (booking: BookingRevenueRow, options?: Parameters<typeof buildBookingRevenue>[1]) => {
  const view = buildBookingRevenue(booking, options);
  if (view.state !== "ready") throw new Error("not ready");
  return view;
};
const values = (lines: RevenueLine[]) => Object.fromEntries(lines.map((l) => [l.label, l.value]));

describe("formatMoney", () => {
  it.each([
    [75, "75.00"],
    [199.98, "199.98"],
    [0.1, "0.10"],
  ])("should show %s as %s, with two decimals and no currency", (value, shown) => {
    expect(formatMoney(value)).toBe(shown);
  });

  it("should say a missing amount is not calculated", () => {
    expect(formatMoney(null)).toBe("Not calculated");
  });
});

describe("formatUsd", () => {
  it.each([
    [20, "USD 20.00"],
    [-20, "-USD 20.00"],
    [0, "USD 0.00"],
  ])("should write %s as %s, the sign before the currency", (value, shown) => {
    expect(formatUsd(value)).toBe(shown);
  });
});

describe("buildBookingRevenue", () => {
  it("should say there is no revenue yet when the rental is not completed", () => {
    const view = buildBookingRevenue(row({ revenue_case: null, status: "confirmed" }));

    expect(view).toMatchObject({ state: "empty", message: expect.stringContaining("not completed") });
  });

  it("should not say a rental completed before revenue was recorded is not completed", () => {
    const view = buildBookingRevenue(row({ revenue_case: null, status: "completed" }));

    expect(view).toMatchObject({ state: "empty", message: expect.stringContaining("before its revenue was recorded") });
  });

  it("should show the days booked and paid, the gross before adjustments and the net after them (AC01, AC03)", () => {
    const { card: c } = card(row(), { adjustments });
    const left = values(c.left);
    const right = values(c.right);

    expect(left["Paid days"]).toBe("8 days booked, 6 days paid");
    expect(left["Daily rate"]).toBe("20.00");
    expect(left["Gross revenue"]).toBe("120.00");
    expect(right["Total adjustments"]).toBe("-20.00");
    expect(right["Net revenue"]).toBe("100.00");
  });

  it("should split the adjustments by type with a negative amount (AC04)", () => {
    const left = card(row(), { adjustments }).card.left;

    expect(values(left)).toMatchObject({ Refund: "-20.00", Adjustment: "-10.00", Chargeback: "-10.00" });
    expect(left.find((l) => l.label === "Refund")?.negative).toBe(true);
  });

  it("should make the two shares add up to the net revenue (AC02)", () => {
    const right = values(card(row(), { adjustments }).card.right);

    expect(Number(right["Partner share · 60%"]) + Number(right["Platform share · 40%"])).toBe(Number(right["Net revenue"]));
  });

  it("should show the platform percentage of a launch share without a floating point tail", () => {
    const terms = { partner_share_percent: 30, platform_share_percent: 70, launch_partner_share_percent: 12.34, effective_from: "2026-01-01" };
    const right = values(card(row({ launch_credit: 1, launch_credit_balance: 1, terms })).card.right);

    expect(right["Platform share · 87.66%"]).toBeDefined();
  });

  it("should leave out the platform lines and the lines per type for a partner user (AC08)", () => {
    const { card: c } = card(row(), { internal: false });

    expect(Object.keys(values(c.right))).toEqual(["Total adjustments", "Net revenue", "Partner share · 60%"]);
    expect(Object.keys(values(c.left))).toEqual(["Paid days", "Daily rate", "Gross revenue"]);
    expect(c.formula.join(" ")).not.toContain("Platform");
  });

  it("should write the formula with the capped days and the adjustments", () => {
    const { formula } = card(row(), { adjustments }).card;

    expect(formula[0]).toBe("How this is calculated: min(8, 6) × USD 20.00 + (-20.00) = USD 100.00");
    expect(formula[1]).toBe("Partner 60% = USD 60.00 + Platform 40% = USD 40.00. Total USD 100.00. Launch credit USD 0.00.");
  });

  it("should say a cancelled booking and a no-show are not charged", () => {
    for (const [revenueCase, text] of [["cancelled", "cancelled"], ["no_show", "no-show"]] as const) {
      const view = card(row({ revenue_case: revenueCase, paid_days: 0, rental_days: null, gross_revenue: 0, adjustments_total: 0, partner_share: 0, platform_share: 0, terms: null }));

      expect(view.notices.join(" ")).toContain(text);
      expect(values(view.card.right)["Net revenue"]).toBe("0.00");
    }
  });

  it("should say a rental with no duration is not charged and show no shares", () => {
    const view = card(row({ revenue_flag: "invalid_duration", rental_days: 0, paid_days: 0, gross_revenue: null, adjustments_total: 0, partner_share: null, platform_share: null, terms: null }));

    expect(view.notices.join(" ")).toContain("no duration");
    expect(values(view.card.right)["Net revenue"]).toBe("Not calculated");
    expect(view.card.formula).toEqual([]);
  });

  it("should say the shares are not calculated when the partner had no terms", () => {
    const view = card(row({ revenue_flag: "no_terms", partner_share: null, platform_share: null, terms: null }));

    expect(view.notices.join(" ")).toContain("no commercial terms");
    expect(values(view.card.right)["Partner share"]).toBe("Not calculated");
  });
});
