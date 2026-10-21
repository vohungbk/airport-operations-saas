import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BackToPartnerHome } from "@/features/partners/components/back-to-partner-home";
import { PARTNER_HOME_ITEMS } from "@/features/partners/lib/partner-home-items";
import { PARTNER_HOME_ROUTE } from "@/lib/constants/routes";

describe("BackToPartnerHome", () => {
  it("should link to the partner home", () => {
    const html = renderToStaticMarkup(createElement(BackToPartnerHome));

    expect(html).toContain(`href="${PARTNER_HOME_ROUTE}"`);
    expect(html).toContain("Back to Partner home");
  });

  it("should close the loop: the home opens the bookings list, which leads back to the home", () => {
    const bookings = PARTNER_HOME_ITEMS.find((item) => item.id === "bookings");

    expect(bookings?.href).toBe("/bookings");
  });
});
