import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EstimateTag } from "@/components/domain/estimate-tag";
import { EstimateVsVerifiedPanel } from "@/components/domain/estimate-vs-verified-panel";
import { InvoiceSummary } from "@/components/domain/invoice-summary";
import { LaunchCreditMeter } from "@/components/domain/launch-credit-meter";
import { MoneyAmount } from "@/components/domain/money-amount";
import { RevenueBreakdown } from "@/components/domain/revenue-breakdown";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("MoneyAmount", () => {
  it("should align right with tabular figures", () => {
    const out = html(createElement(MoneyAmount, { value: 12.5 }));
    expect(out).toContain("text-right");
    expect(out).toContain("tabular-nums");
    expect(out).toContain("12.50");
  });

  it("should write a refund as a negative amount with its name", () => {
    const out = html(createElement(MoneyAmount, { value: -20, kind: "refund" }));
    expect(out).toContain("-20.00");
    expect(out).toContain("Refund");
  });

  it("should write a chargeback as a negative amount with its name", () => {
    const out = html(createElement(MoneyAmount, { value: -5.5, kind: "chargeback" }));
    expect(out).toContain("-5.50");
    expect(out).toContain("Chargeback");
  });

  it("should write zero as 0.00 without a sign", () => {
    const out = html(createElement(MoneyAmount, { value: 0 }));
    expect(out).toContain("0.00");
    expect(out).not.toContain("-0.00");
  });

  it("should write the currency only when it is given", () => {
    expect(html(createElement(MoneyAmount, { value: 1 }))).not.toContain("USD");
    expect(html(createElement(MoneyAmount, { value: 1, currency: "USD" }))).toContain("USD");
  });
});

describe("EstimateTag", () => {
  it("should say Estimate in text", () => {
    expect(html(createElement(EstimateTag))).toContain("Estimate");
  });
});

describe("RevenueBreakdown", () => {
  it("should show each line with its amount and how it was worked out", () => {
    const out = html(
      createElement(RevenueBreakdown, {
        lines: [
          { label: "Partner share", value: 70, note: "70%" },
          { label: "Refund", value: -10, kind: "refund" },
        ],
      }),
    );
    expect(out).toContain("Partner share");
    expect(out).toContain("(70%)");
    expect(out).toContain("70.00");
    expect(out).toContain("-10.00");
  });

  it("should say an amount was not calculated, not show it as zero", () => {
    const out = html(createElement(RevenueBreakdown, { lines: [{ label: "Platform share", value: null }] }));
    expect(out).toContain("Not calculated");
    expect(out).not.toContain("0.00");
  });

  it("should show an empty state, not zeros, when there are no lines", () => {
    const out = html(createElement(RevenueBreakdown, { lines: [] }));
    expect(out).toContain("No revenue yet.");
    expect(out).not.toContain("0.00");
  });

  it("should break a long label instead of overflowing", () => {
    expect(html(createElement(RevenueBreakdown, { lines: [{ label: "x".repeat(80), value: 1 }] }))).toContain("break-words");
  });
});

describe("InvoiceSummary", () => {
  it("should show the subtotal, the VAT with its rate and the total as stored", () => {
    const out = html(createElement(InvoiceSummary, { subtotal: 100, vat: 10, total: 110, vatRatePercent: 10 }));
    expect(out).toContain("Subtotal");
    expect(out).toContain("VAT (10%)");
    expect(out).toContain("110.00");
  });

  it("should write VAT without a rate when the rate is not known", () => {
    expect(html(createElement(InvoiceSummary, { subtotal: 1, vat: 0, total: 1 }))).toContain(">VAT<");
  });

  it("should show a credit note total as negative", () => {
    expect(html(createElement(InvoiceSummary, { subtotal: -100, vat: -10, total: -110 }))).toContain("-110.00");
  });
});

describe("LaunchCreditMeter", () => {
  it("should be a progress bar with its value and its text", () => {
    const out = html(createElement(LaunchCreditMeter, { accumulated: 25, target: 100 }));
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="25"');
    expect(out).toContain("25.00 of 100.00 (25%)");
  });

  it("should stop the bar at 100% and keep the true share when the target is passed", () => {
    const out = html(createElement(LaunchCreditMeter, { accumulated: 120, target: 100 }));
    expect(out).toContain('aria-valuenow="100"');
    expect(out).toContain("(120%)");
  });

  it("should say there is no target instead of drawing a bar", () => {
    const out = html(createElement(LaunchCreditMeter, { accumulated: 10, target: null }));
    expect(out).toContain("No launch target is set.");
    expect(out).not.toContain("progressbar");
  });
});

describe("EstimateVsVerifiedPanel", () => {
  const verified = [
    { label: "Gross", amount: 100 },
    { label: "Refund", amount: -20, kind: "refund" as const },
  ];

  it("should show verified and estimated numbers in two separate sections", () => {
    const out = html(createElement(EstimateVsVerifiedPanel, { verified, estimated: [{ label: "Next month", estimate: 500 }] }));
    expect(out).toContain('data-slot="verified-section"');
    expect(out).toContain('data-slot="estimated-section"');
    expect(out.indexOf("verified-section")).toBeLessThan(out.indexOf("estimated-section"));
  });

  it("should total the verified lines only", () => {
    const out = html(createElement(EstimateVsVerifiedPanel, { verified, estimated: [{ label: "Next month", estimate: 500 }] }));
    expect(out).toContain("80.00");
    expect(out).not.toContain("580.00");
  });

  it("should give the same verified total with and without an estimate", () => {
    const total = (estimated: { label: string; estimate: number }[]) =>
      html(createElement(EstimateVsVerifiedPanel, { verified, estimated })).match(/Verified total[\s\S]*?(\d+\.\d\d)/)?.[1];
    expect(total([])).toBe(total([{ label: "e", estimate: 9999 }]));
  });

  it("should put an Estimate tag on every estimated line", () => {
    const out = html(
      createElement(EstimateVsVerifiedPanel, {
        verified: [],
        estimated: [{ label: "a", estimate: 1 }, { label: "b", estimate: 2 }],
      }),
    );
    expect(out.match(/data-slot="estimate-tag"/g)).toHaveLength(2);
  });

  it("should say so when there is nothing verified or estimated, instead of showing zeros", () => {
    const out = html(createElement(EstimateVsVerifiedPanel, { verified: [], estimated: [] }));
    expect(out).toContain("No verified figures yet.");
    expect(out).toContain("No estimates.");
    expect(out).not.toContain("0.00");
  });
});
