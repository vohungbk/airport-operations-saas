import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/bookings/actions/record-adjustment.action", () => ({
  recordAdjustmentAction: vi.fn(),
}));

import { AdjustmentForm } from "@/features/bookings/components/adjustment-form";

const BOOKING_ID = "f0000000-0000-0000-0000-000000000025";

const render = () =>
  renderToStaticMarkup(
    createElement(AdjustmentForm, { bookingId: BOOKING_ID, maxAmount: 450, onSuccess: () => {}, onCancel: () => {} }),
  );

describe("AdjustmentForm", () => {
  it("should offer the three fields with their labels", () => {
    const html = render();

    expect(html).toContain('for="type">Type<');
    expect(html).toContain('for="amount">Amount<');
    expect(html).toContain('for="reason">Reason<');
  });

  it("should show the amount with a minus and say it reduces the revenue, up to the gross revenue", () => {
    const html = render();

    expect(html).toContain("−");
    expect(html).toContain("This amount reduces the revenue of the booking (up to 450.00).");
  });

  it("should limit the reason to 1000 characters", () => {
    expect(render()).toContain('maxLength="1000"');
  });

  it("should have a Save button and a Cancel button that does not submit", () => {
    const html = render();

    expect(html).toContain(">Save adjustment<");
    expect(html).toMatch(/type="button"[^>]*>[^<]*Cancel</);
  });
});
