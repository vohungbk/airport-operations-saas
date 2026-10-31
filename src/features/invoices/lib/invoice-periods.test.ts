import { describe, expect, it } from "vitest";

import {
  DISABLED_CAPTION,
  PERIOD_LIMIT,
  SELECTABLE_CAPTION,
  buildPeriodOptions,
  type SettlementPeriodRow,
} from "@/features/invoices/lib/invoice-periods";

const row = (change: Partial<SettlementPeriodRow> = {}): SettlementPeriodRow => ({
  partner_id: "p-a",
  period_start: "2026-09-01",
  status: "approved",
  platform_share: 5050,
  fees: 0,
  invoice_id: null,
  ...change,
});

describe("buildPeriodOptions (VI-F09-S06, AC01, AC03)", () => {
  it("should let only the month of an approved settlement be chosen, and say why not for the others", () => {
    const options = buildPeriodOptions(
      [
        row({ period_start: "2026-10-01", status: "draft" }),
        row({ period_start: "2026-09-01" }),
        row({ period_start: "2026-08-01", status: "pending_approval" }),
        row({ period_start: "2026-07-01", status: "paid" }),
      ],
      "p-a",
    );

    expect(options.map((o) => [o.month, o.selectable, o.caption])).toEqual([
      ["2026-10", false, DISABLED_CAPTION],
      ["2026-09", true, SELECTABLE_CAPTION],
      ["2026-08", false, DISABLED_CAPTION],
      ["2026-07", false, DISABLED_CAPTION],
    ]);
  });

  it("should show only the months of the partner asked for, newest first, with the month written out", () => {
    const options = buildPeriodOptions(
      [row({ period_start: "2026-08-01" }), row({ partner_id: "p-b" }), row({ period_start: "2026-09-01" })],
      "p-a",
    );

    expect(options.map((o) => o.label)).toEqual(["September 2026", "August 2026"]);
  });

  it("should work out what the invoice will be worth, with the fees", () => {
    expect(buildPeriodOptions([row({ platform_share: 5050, fees: 0 })], "p-a")[0].amounts).toEqual({
      subtotal: 5050,
      vat: 252.5,
      total: 5302.5,
    });
  });

  it("should keep the invoice that was already made, so the month can be shown as a duplicate", () => {
    expect(buildPeriodOptions([row({ invoice_id: "i-1" })], "p-a")[0].invoice_id).toBe("i-1");
  });

  it("should give nothing for a partner with no settlement", () => {
    expect(buildPeriodOptions([row()], "p-none")).toEqual([]);
  });

  it("should show only the newest months of a partner, not every one it ever had", () => {
    const many = Array.from({ length: PERIOD_LIMIT + 3 }, (_, index) =>
      row({ period_start: `${2020 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01` }),
    );

    expect(buildPeriodOptions(many, "p-a")).toHaveLength(PERIOD_LIMIT);
  });
});
