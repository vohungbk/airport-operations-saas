import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settlements/actions/move-settlement-status.action", () => ({
  moveSettlementStatusAction: vi.fn(),
}));

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
  status_changed_at: "2026-10-25T09:00:00Z",
  partner: { name: "Demo Car Rental", code: "DEMO" },
  ...change,
});

const render = (settlements: SettlementRow[], canMove = false) =>
  renderToStaticMarkup(createElement(SettlementsTable, { settlements, canMove }));

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

  it("should show the date of the last status change under the status (AC01)", () => {
    expect(render([row()])).toContain("2026-10-25");
  });

  it("should show the Move column and the buttons of the status only when the user may move (AC01)", () => {
    expect(render([row()])).not.toContain("Send for approval");
    expect(render([row()])).not.toContain(">Move<");

    const html = render([row()], true);
    expect(html).toContain(">Move<");
    expect(html).toContain("Send for approval");
  });
});
