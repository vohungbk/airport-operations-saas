import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/partners/actions/save-commercial-terms.action", () => ({
  saveCommercialTermsAction: vi.fn(),
}));

import { CommercialTermsForm } from "@/features/partners/components/commercial-terms-form";
import { COMMERCIAL_TERMS_FORM_ID } from "@/features/partners/lib/commercial-terms";

const render = (canEdit = true, paymentTermsDays = 14) =>
  renderToStaticMarkup(
    createElement(CommercialTermsForm, {
      partnerId: "a0000000-0000-0000-0000-000000000001",
      today: "2026-10-24",
      canEdit,
      defaultValues: {
        partner_share_percent: 30,
        launch_partner_share_percent: 50,
        launch_credit_target: 10000,
        annual_fee: 3600,
        onboarding_fee: 500,
        vat_rate_percent: 5,
        payment_terms_days: paymentTermsDays,
        effective_from: "2026-10-24",
      },
    }),
  );

describe("CommercialTermsForm", () => {
  it("should be the card of the design with its title and description", () => {
    const html = render();

    expect(html).toContain("Revenue and programme terms");
    expect(html).toContain("Define revenue sharing and programme charges.");
    expect(html).toContain(`id="${COMMERCIAL_TERMS_FORM_ID}"`);
  });

  it("should offer the eight fields with the labels of the design", () => {
    const html = render();

    for (const label of [
      "Standard partner share (%)",
      "Launch partner share (%)",
      "Launch credit target (USD)",
      "Annual programme fee (USD)",
      "Onboarding credit (USD)",
      "VAT (%)",
      "Payment terms",
      "Effective date",
    ]) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it("should show the hints of the design under the fields", () => {
    const html = render();

    for (const hint of [
      "Must be at least the standard partner share.",
      "Exact amount · 2 decimal places",
      "Charged annually",
      "One-time credit",
      "Allowed range: 0–100%",
      "Payment due after issue",
      "New version takes effect on this date",
      "Share limits: 0–100% · Launch share ≥ standard share",
      "All monetary values are stored with 2 decimal places.",
    ]) {
      expect(html).toContain(hint);
    }
  });

  it("should show the platform share as the rest in its hint (AC03)", () => {
    expect(render()).toContain('data-testid="platform-share">70%<');
  });

  it("should show the money as 10,000.00 and the date as 24 Oct 2026", () => {
    const html = render();

    expect(html).toContain("10,000.00");
    expect(html).toContain("3,600.00");
    expect(html).toContain("500.00");
    expect(html).toContain("24 Oct 2026");
  });

  it("should make every field 44px high", () => {
    const html = render();

    expect(html.match(/h-11/g)?.length).toBeGreaterThanOrEqual(8);
    expect(html).toContain("data-[size=default]:h-11");
  });

  it("should leave the fields on for an admin and have no Save button of its own", () => {
    const html = render();

    expect(html).not.toContain("disabled");
    expect(html).not.toContain(">Save");
    expect(html).not.toContain("Only an admin can change commercial terms.");
  });

  it("should switch every field off and say who can change the terms when the user cannot edit", () => {
    const html = render(false);

    expect(html).toContain("Only an admin can change commercial terms.");
    expect(html.match(/disabled/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("should keep a saved payment term that is not one of the standard ones", () => {
    expect(render(true, 21)).toContain("Net 21 days");
  });
});
