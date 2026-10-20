import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerHomeNav } from "@/features/partners/components/partner-home-nav";
import { PARTNER_HOME_ITEMS } from "@/features/partners/lib/partner-home-items";

describe("PartnerHomeNav", () => {
  it("should link each released view and show an unreleased one without a link", () => {
    const html = renderToStaticMarkup(createElement(PartnerHomeNav));

    for (const item of PARTNER_HOME_ITEMS) {
      expect(html).toContain(item.label);
      if (item.href) {
        expect(html).toContain(`href="${item.href}"`);
      }
    }
    expect(html).toContain('href="/bookings"');
    expect(html.match(/<a /g)).toHaveLength(
      PARTNER_HOME_ITEMS.filter((item) => item.href).length,
    );
    expect(html).toContain("Not available yet");
  });
});
