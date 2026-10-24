import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CommercialTermsHistory } from "@/features/partners/components/commercial-terms-history";
import type { CommercialTermsVersion } from "@/features/partners/lib/commercial-terms";

const ended = (id: string, from: string, to: string, partner = 30): CommercialTermsVersion => ({
  id,
  partner_share_percent: partner,
  platform_share_percent: 100 - partner,
  launch_partner_share_percent: 50,
  launch_credit_target: 2500,
  annual_fee: 1200,
  onboarding_fee: 300,
  vat_rate_percent: 20,
  payment_terms_days: 30,
  effective_from: from,
  effective_to: to,
});

const render = (earlier: CommercialTermsVersion[], truncated = false) =>
  renderToStaticMarkup(createElement(CommercialTermsHistory, { earlier, truncated, limit: 100 }));

describe("CommercialTermsHistory", () => {
  it("should say there are no earlier terms when the list is empty", () => {
    const html = render([]);

    expect(html).toContain("Earlier terms");
    expect(html).toContain("No earlier terms");
  });

  it("should list each earlier version with the days it applied (AC01)", () => {
    const html = render([ended("b", "2026-01-01", "2026-06-30", 35), ended("a", "2025-01-01", "2025-12-31")]);

    expect(html).toContain("2026-01-01 to 2026-06-30");
    expect(html).toContain("2025-01-01 to 2025-12-31");
    expect(html.indexOf("2026-01-01 to")).toBeLessThan(html.indexOf("2025-01-01 to"));
  });

  it("should show the terms of an earlier version as they were", () => {
    const html = render([ended("a", "2025-01-01", "2025-12-31", 35)]);

    expect(html).toContain("35%");
    expect(html).toContain("65%");
    expect(html).toContain("1200");
    expect(html).toContain("20%");
    expect(html).toContain("30 days");
    expect(html).toContain("2500");
  });

  it("should be read only: no form field and no button", () => {
    const html = render([ended("a", "2025-01-01", "2025-12-31")]);

    expect(html).not.toMatch(/<input|<button|<form/);
  });

  it("should note that older versions were cut off, with the limit", () => {
    expect(render([ended("a", "2025-01-01", "2025-12-31")], true)).toContain("Only the latest 100 versions are shown.");
    expect(render([ended("a", "2025-01-01", "2025-12-31")], false)).not.toContain("Only the latest");
  });
});
