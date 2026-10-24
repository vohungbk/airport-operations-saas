import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommercialTermsSummary } from "@/features/partners/components/commercial-terms-summary";
import type { CommercialTermsVersion } from "@/features/partners/lib/commercial-terms";

const version = (id: string, from: string, partner = 30): CommercialTermsVersion => ({
  id,
  partner_share_percent: partner,
  platform_share_percent: 100 - partner,
  launch_partner_share_percent: 50,
  launch_credit_target: null,
  annual_fee: 1200,
  onboarding_fee: 300.5,
  vat_rate_percent: 7.5,
  payment_terms_days: 14,
  effective_from: from,
  effective_to: null,
});

const render = (current: CommercialTermsVersion | null, upcoming: CommercialTermsVersion[] = []) =>
  renderToStaticMarkup(createElement(CommercialTermsSummary, { terms: { current, upcoming } }));

describe("CommercialTermsSummary", () => {
  it("should say there are no terms yet when the partner has none (empty state)", () => {
    const html = render(null);

    expect(html).toContain("No commercial terms yet");
  });

  it("should show the shares and the start of the terms in force", () => {
    const html = render(version("a", "2026-01-01", 35));

    expect(html).toContain("Terms in force");
    expect(html).toContain("35%");
    expect(html).toContain("65%");
    expect(html).toContain("50%");
    expect(html).toContain("2026-01-01");
  });

  it("should show the fees, the VAT rate and the payment terms of the terms in force (VI-F04-S02)", () => {
    const html = render(version("a", "2026-01-01"));

    expect(html).toContain("Annual programme fee");
    expect(html).toContain("1200");
    expect(html).toContain("300.5");
    expect(html).toContain("7.5%");
    expect(html).toContain("14 days");
    expect(html).toContain(">None<");
  });

  it("should show the launch credit target when there is one", () => {
    const html = render({ ...version("a", "2026-01-01"), launch_credit_target: 5000 });

    expect(html).toContain("5000");
    expect(html).not.toContain(">None<");
  });

  it("should show terms that start later apart from the ones in force", () => {
    const html = render(version("a", "2026-01-01"), [version("b", "2026-12-01", 40)]);

    expect(html).toContain("Terms in force");
    expect(html).toContain("Starts later");
    expect(html).toContain("2026-12-01");
  });

  it("should show terms that start later even when nothing is in force yet", () => {
    const html = render(null, [version("b", "2026-12-01")]);

    expect(html).not.toContain("No commercial terms yet");
    expect(html).toContain("Starts later");
  });
});
