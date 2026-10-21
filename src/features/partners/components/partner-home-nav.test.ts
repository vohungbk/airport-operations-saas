import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// One released view and one that is not, whatever the real list says today.
vi.mock("@/features/partners/lib/partner-home-items", () => ({
  PARTNER_HOME_ITEMS: [
    { id: "bookings", label: "Bookings", description: "b", href: "/bookings" },
    { id: "seats", label: "Seats", description: "s", href: null },
  ],
}));

import { PartnerHomeNav } from "@/features/partners/components/partner-home-nav";

describe("PartnerHomeNav", () => {
  it("should link a released view and show an unreleased one without a link", () => {
    const html = renderToStaticMarkup(createElement(PartnerHomeNav));

    expect(html).toContain('href="/bookings"');
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("Seats");
    expect(html).toContain("Not available yet");
  });
});
