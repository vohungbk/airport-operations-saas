import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettlementsTable } from "@/features/settlements/components/settlements-table";
import type { SettlementRow } from "@/features/settlements/lib/get-settlements";

const row = (change: Partial<SettlementRow> = {}): SettlementRow => ({
  id: "s-1",
  period_start: "2026-09-01",
  gross_revenue: 740,
  partner_share: 222,
  platform_share: 518,
  refunds: 100,
  adjustments: 10,
  chargebacks: 50,
  launch_credit: 90,
  fees: 0,
  final_amount: 222,
  status: "draft",
  partner: { name: "Demo Car Rental", code: "DEMO" },
  ...change,
});

const render = (settlements: SettlementRow[]) =>
  renderToStaticMarkup(createElement(SettlementsTable, { settlements }));

describe("SettlementsTable", () => {
  it("should have a column for every figure of the spec (R6)", () => {
    const html = render([row()]);

    for (const column of [
      "Month", "Partner", "Gross revenue", "Partner share", "Platform share", "Refunds",
      "Adjustments", "Chargebacks", "Credits", "Fees", "Final amount", "Status",
    ]) {
      expect(html).toContain(`>${column}<`);
    }
  });

  it("should show the month, the partner, the amounts with two decimals and the status (AC03)", () => {
    const html = render([row()]);

    expect(html).toContain(">2026-09<");
    expect(html).toContain("Demo Car Rental (DEMO)");
    expect(html).toContain(">740.00<");
    expect(html).toContain(">518.00<");
    expect(html).toContain(">Draft<");
  });

  it("should not break when the partner is not readable", () => {
    expect(render([row({ partner: null })])).toContain(">-<");
  });
});
