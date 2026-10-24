import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AdjustmentNotFound from "@/app/(dashboard)/bookings/[id]/adjustment/not-found";

describe("AdjustmentNotFound", () => {
  it("should not say whether the booking exists, and link back to the bookings", () => {
    const html = renderToStaticMarkup(createElement(AdjustmentNotFound));

    expect(html).toContain("Booking not found");
    expect(html).toContain("does not exist or you cannot see it");
    expect(html).toContain('href="/bookings"');
  });
});
