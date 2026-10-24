import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import BookingRevenueNotFound from "@/app/(dashboard)/bookings/[id]/revenue/not-found";

describe("BookingRevenueNotFound", () => {
  it("should not say whether the booking exists, and link back to the bookings", () => {
    const html = renderToStaticMarkup(createElement(BookingRevenueNotFound));

    expect(html).toContain("Booking not found");
    expect(html).toContain("does not exist or you cannot see");
    expect(html).toContain('href="/bookings"');
  });
});
