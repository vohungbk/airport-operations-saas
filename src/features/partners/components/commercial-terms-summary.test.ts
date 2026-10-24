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
