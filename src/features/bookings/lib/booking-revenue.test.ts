import { describe, expect, it } from "vitest";

import { buildBookingRevenue, formatMoney } from "@/features/bookings/lib/booking-revenue";
import type { BookingRevenueRow } from "@/features/bookings/lib/get-booking-revenue";

const row = (overrides: Partial<BookingRevenueRow> = {}): BookingRevenueRow => ({
  id: "b-1",
  booking_number: "BK-00001",
  status: "completed",
  daily_rate: 75,
  paid_days: 6,
  rental_days: 6,
  gross_revenue: 450,
  adjustments_total: 0,
  partner_share: 135,
  platform_share: 315,
  launch_credit: 0,
  launch_credit_balance: null,
  revenue_case: "standard",
  revenue_flag: null,
  terms: {
    partner_share_percent: 30,
    platform_share_percent: 70,
    launch_partner_share_percent: 50,
    effective_from: "2026-01-01",
  },
  ...overrides,
});

const lines = (booking: BookingRevenueRow) => {
  const view = buildBookingRevenue(booking);
  if (view.state !== "ready") throw new Error("not ready");
  return Object.fromEntries(view.lines.map((line) => [line.label, line.value]));
};

describe("formatMoney", () => {
  it.each([
    [75, "75.00"],
    [199.98, "199.98"],
    [0, "0.00"],
    [0.1, "0.10"],
  ])("should show %s as %s, with two decimals and no currency", (value, shown) => {
    expect(formatMoney(value)).toBe(shown);
  });

  it("should say a missing amount is not calculated", () => {
    expect(formatMoney(null)).toBe("Not calculated");
  });
});

describe("buildBookingRevenue", () => {
  it("should say there is no revenue yet when the rental is not completed (empty state)", () => {
    const view = buildBookingRevenue(row({ revenue_case: null, status: "confirmed", paid_days: 0, rental_days: null, gross_revenue: null, partner_share: null, platform_share: null, terms: null }));

    expect(view.state).toBe("empty");
    expect(view).toMatchObject({ message: expect.stringContaining("not completed") });
  });

  it("should not say a rental that was completed long ago is not completed", () => {
    const view = buildBookingRevenue(row({ revenue_case: null, status: "completed", paid_days: 0, rental_days: null, gross_revenue: null, partner_share: null, platform_share: null, terms: null }));

    expect(view).toMatchObject({ state: "empty", message: expect.stringContaining("before its revenue was recorded") });
  });

  it("should show the platform percentage of a launch share without a floating point tail", () => {
    const shown = lines(row({ launch_credit: 1, launch_credit_balance: 1, terms: { partner_share_percent: 30, platform_share_percent: 70, launch_partner_share_percent: 12.34, effective_from: "2026-01-01" } }));

    expect(shown["Platform share"]).toContain("(87.66%)");
  });

  it("should explain a standard rental: the days, the rate, the gross and the shares with their percentages (AC02)", () => {
    expect(lines(row())).toEqual({
      Case: "Standard rental",
      "Rental days": "6",
      "Paid days": "6",
      "Daily rate": "75.00",
      "Gross revenue": "450.00",
      Adjustments: "None",
      "Partner share": "135.00 (30%)",
      "Platform share": "315.00 (70%)",
      "Launch credit": "Launch terms did not apply",
      "Terms used": "In force from 2026-01-01",
    });
  });

  it("should show what the adjustments took off and the gross revenue that is left (VI-F04-S10)", () => {
    const shown = lines(row({ gross_revenue: 400, adjustments_total: -50, partner_share: 120, platform_share: 280 }));

    expect(shown["Gross revenue"]).toBe("400.00 (after 50.00 of adjustments)");
    expect(shown["Adjustments"]).toBe("-50.00");
    expect(shown["Partner share"]).toBe("120.00 (30%)");
  });

  it("should show a booking refunded in full with zero revenue and zero shares", () => {
    const shown = lines(row({ gross_revenue: 0, adjustments_total: -450, partner_share: 0, platform_share: 0 }));

    expect(shown["Gross revenue"]).toBe("0.00 (after 450.00 of adjustments)");
    expect(shown["Platform share"]).toBe("0.00 (70%)");
  });

  it("should show the actual days and say only the first days are charged when the cap applies", () => {
    const shown = lines(row({ rental_days: 30, paid_days: 6 }));

    expect(shown["Rental days"]).toBe("30");
    expect(shown["Paid days"]).toBe("6 (only the first 6 of 30 days are charged)");
  });

  it("should show the launch share and the credit when launch terms applied", () => {
    const shown = lines(
      row({ partner_share: 225, platform_share: 225, launch_credit: 90, launch_credit_balance: 90 }),
    );

    expect(shown["Partner share"]).toBe("225.00 (50%)");
    expect(shown["Platform share"]).toBe("225.00 (50%)");
    expect(shown["Launch credit"]).toBe("90.00 added (balance after this rental 90.00)");
  });

  it("should show a balance above the target as it was stored", () => {
    expect(lines(row({ launch_credit: 54, launch_credit_balance: 108 }))["Launch credit"]).toContain("balance after this rental 108.00");
  });

  it("should say a cancelled booking and a no-show are not charged, and show zero (AC02)", () => {
    for (const [revenueCase, text] of [["cancelled", "cancelled"], ["no_show", "no-show"]] as const) {
      const booking = row({ revenue_case: revenueCase, status: revenueCase, paid_days: 0, rental_days: null, gross_revenue: 0, partner_share: 0, platform_share: 0, terms: null });
      const view = buildBookingRevenue(booking);

      expect(view.state === "ready" && view.notices.join(" ")).toContain(text);
      expect(lines(booking)["Gross revenue"]).toBe("0.00");
      expect(lines(booking)["Terms used"]).toBe("None");
    }
  });

  it("should label a rental returned early", () => {
    expect(lines(row({ revenue_case: "early_return", rental_days: 3, paid_days: 3, gross_revenue: 225, partner_share: 67.5, platform_share: 157.5 }))["Case"]).toBe("Returned early");
  });

  it("should say a rental with no duration is not charged and show no shares", () => {
    const booking = row({ revenue_flag: "invalid_duration", rental_days: 0, paid_days: 0, gross_revenue: null, partner_share: null, platform_share: null, terms: null });
    const view = buildBookingRevenue(booking);

    expect(view.state === "ready" && view.notices.join(" ")).toContain("no duration");
    expect(lines(booking)["Gross revenue"]).toBe("Not calculated");
    expect(lines(booking)["Partner share"]).toBe("Not calculated");
  });

  it("should say the shares are not calculated when the partner had no terms, and still show the gross", () => {
    const booking = row({ revenue_flag: "no_terms", partner_share: null, platform_share: null, terms: null });
    const view = buildBookingRevenue(booking);

    expect(view.state === "ready" && view.notices.join(" ")).toContain("no commercial terms");
    expect(lines(booking)["Gross revenue"]).toBe("450.00");
    expect(lines(booking)["Platform share"]).toBe("Not calculated");
  });

  it("should show the two shares adding up to the gross revenue", () => {
    const shown = lines(row({ gross_revenue: 199.98, partner_share: 66.65, platform_share: 133.33 }));

    expect(Number(shown["Partner share"].split(" ")[0]) + Number(shown["Platform share"].split(" ")[0])).toBeCloseTo(199.98, 2);
  });
});
