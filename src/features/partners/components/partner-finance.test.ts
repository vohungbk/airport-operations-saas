import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerFinance } from "@/features/partners/components/partner-finance";
import {
  buildPartnerFinance,
  type PartnerFinanceData,
} from "@/features/partners/lib/partner-finance";

const DATA: PartnerFinanceData = {
  settlement: { period_start: "2026-10-01", gross_revenue: 12000, partner_share: 6000, final_amount: 5670 },
  invoices: [
    { id: "i-1", invoice_number: "INV-2026-0010", issue_date: "2026-10-31", total: 5953.5, status: "issued", period_start: "2026-10-01" },
    { id: "i-2", invoice_number: "INV-2026-0008", issue_date: "2026-08-31", total: 1260, status: "overdue", period_start: "2026-08-01" },
  ],
  terms: {
    partner_share_percent: 30,
    launch_partner_share_percent: 50,
    launch_mode: true,
    launch_credit_target: 5000,
    launch_credit_accumulated: 1250,
  },
};

const render = (data: PartnerFinanceData = DATA) =>
  renderToStaticMarkup(createElement(PartnerFinance, { view: buildPartnerFinance(data) }));

describe("PartnerFinance (VI-F04-S14)", () => {
  it("should show the four tiles of the design with their figures and captions", () => {
    const out = render();

    for (const text of [
      "Gross revenue",
      "$12,000",
      "USD · October 2026",
      "Partner share",
      "USD · Launch share 50%",
      "Amount payable",
      "$5,670",
      "USD · Before VAT",
      "Outstanding invoices",
      "$7,213.50",
      "USD · 2 open invoices",
    ]) {
      expect(out).toContain(text);
    }
  });

  it("should show the invoices and statements as a read-only table", () => {
    const out = render();

    expect(out).toContain("Invoices and statements");
    expect(out).toContain("INV-2026-0010");
    expect(out).toContain("31 Oct 2026");
    expect(out).toContain("USD 5,953.50");
    expect(out).toContain("Overdue");
    expect(out).not.toContain("<button");
    expect(out).not.toContain("<a ");
  });

  it("should show the launch credit balance with its progress toward the target", () => {
    const out = render();

    expect(out).toContain("Launch credit");
    expect(out).toContain("1250.00");
    expect(out).toContain('role="progressbar"');
    expect(out).toContain("(25%)");
  });

  it("should say there is no launch target, and show no balance, when the terms have none", () => {
    const out = render({ ...DATA, terms: { ...DATA.terms!, launch_credit_target: null } });

    expect(out).toContain("No launch target is set.");
    expect(out).not.toContain('role="progressbar"');
  });

  it("should show the note about the finance records, the way the design words it", () => {
    const out = render();

    expect(out).toContain("Your finance records");
    expect(out).toContain("Contact Operations for billing questions.");
    expect(out).toContain("Internal adjustments and commercial controls are not available in this workspace.");
  });

  it("should say there are no invoices, and still show the tiles, when only a settlement exists", () => {
    const out = render({ ...DATA, invoices: [] });

    expect(out).toContain("No invoices yet.");
    expect(out).toContain("$12,000");
    expect(out).toContain("USD · 0 open invoices");
  });
});
