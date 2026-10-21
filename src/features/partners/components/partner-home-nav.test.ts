import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartnerHomeNav } from "@/features/partners/components/partner-home-nav";
import type { PartnerHomeItem } from "@/features/partners/lib/partner-home-items";

// One released view and one that is not, whatever the real list says today.
const ITEMS: PartnerHomeItem[] = [
  {
    id: "bookings",
    label: "Bookings",
    description: "b",
    permission: "bookings:view_own_partner",
    href: "/bookings",
  },
  {
    id: "finance",
    label: "Finance",
    description: "f",
    permission: "finance:view_own_partner",
    href: null,
  },
];

describe("PartnerHomeNav", () => {
  it("should link a released view and show an unreleased one without a link", () => {
    const html = renderToStaticMarkup(createElement(PartnerHomeNav, { items: ITEMS }));

    expect(html).toContain('href="/bookings"');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("Finance");
    expect(html).toContain("Not available yet");
  });

  it("should show only the views it is given", () => {
    const html = renderToStaticMarkup(
      createElement(PartnerHomeNav, { items: [ITEMS[0]] }),
    );

    expect(html).not.toContain("Finance");
    expect(html).not.toContain("Not available yet");
  });
});
