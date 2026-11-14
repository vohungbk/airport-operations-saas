import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettlementsTable } from "@/features/settlements/components/settlements-table";
import type { SettlementRow } from "@/features/settlements/lib/get-settlements";

const row = (change: Partial<SettlementRow> = {}): SettlementRow => ({
  id: "s-1",
  settlement_number: "SET-2026-0009",
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
  status_changed_at: "2026-10-25T09:00:00Z",
  partner: { name: "Demo Car Rental", code: "DEMO" },
  ...change,
});

const render = (settlements: SettlementRow[]) =>
  renderToStaticMarkup(createElement(SettlementsTable, { settlements }));

describe("SettlementsTable", () => {
  it("should have the columns of the design", () => {
    const html = render([row()]);

    for (const column of [
      "Settlement", "Partner", "Period", "Gross revenue", "Partner share", "Platform share",
      "Adjustments", "Amount", "Status",
    ]) {
      expect(html).toContain(`>${column}<`);
    }
  });

  it("should show the number, the partner name, the period, the amounts with separators and the status badge", () => {
    const html = render([row({ gross_revenue: 11865, final_amount: 5932.5 })]);

    expect(html).toContain(">SET-2026-0009<");
    expect(html).toContain("Demo Car Rental");
    expect(html).not.toContain("(DEMO)");
    expect(html).toContain(">September 2026<");
    expect(html).toContain(">11,865.00<");
    expect(html).toContain(">5,932.50<");
    expect(html).toContain('data-domain="settlement"');
    expect(html).toContain(">Draft<");
  });

  it("should not break when the partner is not readable", () => {
    expect(render([row({ partner: null })])).toContain(">-<");
  });

  it("should have no Move column and no status buttons, as the design has none", () => {
    const html = render([row()]);

    expect(html).not.toContain(">Move<");
    expect(html).not.toContain("Send for approval");
  });
});
