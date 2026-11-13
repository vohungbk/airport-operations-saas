import { describe, expect, it } from "vitest";

import type { CoreKpis } from "@/lib/kpi/get-core-kpis";
import {
  buildPartnerOverview,
  type PartnerOverviewInputs,
} from "@/features/partners/lib/partner-overview";
import type { PartnerFinanceData } from "@/features/partners/lib/partner-finance";

const NOW = new Date("2026-10-24T09:00:00.000Z");

const CORE: CoreKpis = {
  correct_seat: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
  family_ready_on_time: { state: "value", percent: 97.5, numerator: 234, denominator: 240, excluded: 0 },
  traceability: { state: "no_data" },
  incidents: { state: "value", incidents: 3, completed_bookings: 240, percent: 1.25 },
  commercial: { state: "no_data" },
};

const FINANCE: PartnerFinanceData = {
  settlement: { period_start: "2026-10-01", gross_revenue: 12000, partner_share: 6000, final_amount: 5670 },
  invoices: [
    { id: "i-1", invoice_number: "INV-1", issue_date: "2026-10-05", total: 630, status: "issued", period_start: null },
    { id: "i-2", invoice_number: "INV-2", issue_date: "2026-10-06", total: 630, status: "overdue", period_start: null },
    { id: "i-3", invoice_number: "INV-3", issue_date: "2026-09-06", total: 900, status: "paid", period_start: null },
  ],
  terms: {
    partner_share_percent: 30,
    launch_partner_share_percent: 50,
    launch_mode: true,
    launch_credit_target: 10000,
    launch_credit_accumulated: 6000,
  },
};

const FULL: PartnerOverviewInputs = {
  rentals_today: 18,
  rentals_yesterday: 15,
  active_rentals: 12,
  upcoming_reservations: 26,
  family_ready: 16,
  awaiting_installation: 2,
  resolved_incidents: 2,
  core: CORE,
  finance: FINANCE,
};

const EMPTY: PartnerOverviewInputs = {
  rentals_today: null,
  rentals_yesterday: null,
  active_rentals: null,
  upcoming_reservations: null,
  family_ready: null,
  awaiting_installation: null,
  resolved_incidents: null,
  core: null,
  finance: null,
};

const tile = (view: ReturnType<typeof buildPartnerOverview>, label: string) =>
  view.tiles.find((item) => item.label === label);

describe("buildPartnerOverview (VI-F11-S10)", () => {
  it("should give the eight tiles of the design with their value and caption", () => {
    const view = buildPartnerOverview(FULL, NOW);

    expect(view.tiles.map(({ label, value, caption }) => [label, value, caption])).toEqual([
      ["Rentals today", "18", "↑ 3 vs yesterday"],
      ["Active rentals", "12", "Currently in use"],
      ["Upcoming reservations", "26", "Next 7 days"],
      ["Family Ready vehicles", "16", "2 awaiting installation"],
      ["Correct-seat fulfilment", "99.2%", "238 / 240 bookings"],
      ["On-time readiness", "97.5%", "234 / 240 bookings"],
      ["Operational incidents", "3", "2 resolved this month"],
      ["Completed rentals", "240", "October to date"],
    ]);
  });

  it("should open the KPI screen from every operations figure", () => {
    const view = buildPartnerOverview(FULL, NOW);

    expect(new Set(view.tiles.map((item) => item.href))).toEqual(new Set(["/partner/kpi"]));
  });

  it("should show the revenue rows from the latest settlement and the open invoices", () => {
    expect(buildPartnerOverview(FULL, NOW).revenue).toEqual([
      { label: "Gross child-seat revenue", value: "USD 12,000.00" },
      { label: "Partner revenue share", value: "USD 6,000.00" },
      { label: "Amount payable", value: "USD 5,670.00" },
      { label: "Open invoices", value: "2" },
      { label: "Outstanding invoice value", value: "USD 1,260.00" },
    ]);
  });

  it("should show the launch credit with the share that follows the target", () => {
    expect(buildPartnerOverview(FULL, NOW).launch_credit).toEqual({
      amount: "USD 6,000 / 10,000",
      share: "50 / 50 current share",
      percent: 60,
      progress: "60%",
      note: "USD 4,000 remaining. Share becomes 30 / 70 after the launch-credit target is reached.",
    });
  });

  it("should show a dash, never a made-up 0, for a figure that could not be read", () => {
    const view = buildPartnerOverview(EMPTY, NOW);

    expect(view.tiles.map((item) => item.value)).toEqual(Array(8).fill("—"));
    expect(view.revenue.map((row) => row.value)).toEqual(Array(5).fill("—"));
    expect(view.launch_credit).toBeNull();
  });

  it.each([
    [15, "Same as yesterday"],
    [20, "↓ 5 vs yesterday"],
  ])("should word rentals today against yesterday when yesterday had %i", (yesterday, caption) => {
    const view = buildPartnerOverview({ ...FULL, rentals_today: 15, rentals_yesterday: yesterday }, NOW);

    expect(tile(view, "Rentals today")?.caption).toBe(caption);
  });

  it("should say what is missing, not 0%, when a rate has no data or nothing stored", () => {
    const view = buildPartnerOverview(
      {
        ...FULL,
        core: {
          ...CORE,
          correct_seat: { state: "no_data" },
          family_ready_on_time: { state: "not_available", reason: "No deadline is stored for these bookings" },
        },
      },
      NOW,
    );

    expect(tile(view, "Correct-seat fulfilment")).toMatchObject({ value: "No data", caption: "No completed rentals yet" });
    expect(tile(view, "On-time readiness")).toMatchObject({
      value: "Not available",
      caption: "No deadline is stored for these bookings",
    });
  });

  it("should say No data, never 0, for the incidents and completed rentals when no rental is completed (R13)", () => {
    const view = buildPartnerOverview({ ...FULL, core: { ...CORE, incidents: { state: "no_data" } } }, NOW);

    expect(tile(view, "Completed rentals")?.value).toBe("No data");
    expect(tile(view, "Operational incidents")).toMatchObject({ value: "No data", caption: "No completed rentals yet" });
  });

  it("should not promise a share change once the launch is over, and not draw a bar with no target", () => {
    const over = buildPartnerOverview(
      { ...FULL, finance: { ...FINANCE, terms: { ...FINANCE.terms!, launch_mode: false } } },
      NOW,
    );
    const none = buildPartnerOverview(
      { ...FULL, finance: { ...FINANCE, terms: { ...FINANCE.terms!, launch_credit_target: null } } },
      NOW,
    );

    expect(over.launch_credit).toMatchObject({ share: "30 / 70 current share", note: null });
    expect(none.launch_credit).toBeNull();
  });
});
