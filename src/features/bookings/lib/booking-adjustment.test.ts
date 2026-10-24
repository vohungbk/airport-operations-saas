import { describe, expect, it } from "vitest";

import { canAddAdjustment } from "@/features/bookings/lib/booking-adjustment";
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
  terms: null,
  ...overrides,
});

describe("canAddAdjustment", () => {
  it.each([
    ["a standard rental", { revenue_case: "standard" }],
    ["a rental returned early", { revenue_case: "early_return" }],
    ["a completed rental whose partner had no terms", { revenue_flag: "no_terms", partner_share: null, platform_share: null }],
  ])("should allow an adjustment on %s", (_name, change) => {
    expect(canAddAdjustment(row(change))).toBe(true);
  });

  it.each([
    ["a booking that is not completed", { revenue_case: null, gross_revenue: null }],
    ["a cancelled booking", { revenue_case: "cancelled", gross_revenue: 0 }],
    ["a no-show", { revenue_case: "no_show", gross_revenue: 0 }],
    ["a rental with no duration", { revenue_flag: "invalid_duration", gross_revenue: null }],
    ["a rental with no gross revenue", { gross_revenue: null }],
    ["a rental already refunded in full: gross revenue zero", { gross_revenue: 0, adjustments_total: -450 }],
  ])("should not allow an adjustment on %s: there is nothing to correct", (_name, change) => {
    expect(canAddAdjustment(row(change))).toBe(false);
  });
});
