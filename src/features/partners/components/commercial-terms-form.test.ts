import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/partners/actions/save-commercial-terms.action", () => ({
  saveCommercialTermsAction: vi.fn(),
}));

import { CommercialTermsForm } from "@/features/partners/components/commercial-terms-form";

const render = () =>
  renderToStaticMarkup(
    createElement(CommercialTermsForm, {
      partnerId: "a0000000-0000-0000-0000-000000000001",
      today: "2026-10-24",
      defaultValues: {
        partner_share_percent: 30,
        launch_partner_share_percent: 50,
        launch_credit_target: null,
        annual_fee: 0,
        onboarding_fee: 0,
        vat_rate_percent: 0,
        payment_terms_days: 14,
        effective_from: "2026-10-24",
      },
    }),
  );

describe("CommercialTermsForm", () => {
  it("should offer the three fields with their labels (AC01)", () => {
    const html = render();

    expect(html).toContain('for="partner_share_percent">Partner share (%)<');
    expect(html).toContain('for="launch_partner_share_percent">Launch partner share (%)<');
    expect(html).toContain('for="effective_from">Effective from<');
    expect(html).toContain('type="number"');
    expect(html).toContain('type="date"');
  });

  // The inputs are uncontrolled (react-hook-form fills them in the browser), so the start values
  // show on the screen in the derived platform share: 100 - 30.
  it("should offer the launch target, the fees, the VAT rate and the payment terms (VI-F04-S02 AC01)", () => {
    const html = render();

    expect(html).toContain("Launch credit target (leave empty for none)");
    expect(html).toContain("Annual programme fee");
    expect(html).toContain("Onboarding credit");
    expect(html).toContain("VAT rate (%)");
    expect(html).toContain("Payment terms (days until an invoice is due)");
    expect(html).toContain('id="payment_terms_days" type="number" data-slot="input" step="1"');
  });

  it("should show the platform share as the rest, read only (AC03)", () => {
    const html = render();

    expect(html).toContain("Platform share (%)");
    expect(html).toContain('data-testid="platform-share">70<');
  });

  it("should not let the date go before today", () => {
    expect(render()).toContain('min="2026-10-24"');
  });

  it("should have a Save button", () => {
    expect(render()).toContain(">Save terms<");
  });
});
