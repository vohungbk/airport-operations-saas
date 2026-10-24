import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/bookings/actions/record-adjustment.action", () => ({
  recordAdjustmentAction: vi.fn(),
}));

import { AdjustmentForm } from "@/features/bookings/components/adjustment-form";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";

const render = () => renderToStaticMarkup(createElement(AdjustmentForm, { bookingId: BOOKING_ID, maxAmount: 450 }));

describe("AdjustmentForm", () => {
  it("should offer the three fields with their labels (AC01)", () => {
    const html = render();

    expect(html).toContain('for="type">Type<');
    expect(html).toContain('for="amount">Amount<');
    expect(html).toContain('for="reason">Reason<');
  });

  it("should take the amount as a number in cents, no more than the gross revenue", () => {
    const html = render();

    expect(html).toContain('id="amount" type="number"');
    expect(html).toContain('step="0.01"');
    expect(html).toContain('max="450"');
  });

  it("should limit the reason to 1000 characters", () => {
    expect(render()).toContain('maxLength="1000"');
  });

  it("should have a Save button and a Cancel link back to Booking revenue (AC08)", () => {
    const html = render();

    expect(html).toContain(">Save adjustment<");
    expect(html).toContain(`href="/bookings/${BOOKING_ID}/revenue"`);
    expect(html).toContain(">Cancel<");
  });

  it("should start with nothing chosen: no default type and no default amount", () => {
    const html = render();

    expect(html).not.toMatch(/value="\d/);
  });
});
