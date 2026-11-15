import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settlements/actions/generate-settlement.action", () => ({
  generateSettlementAction: vi.fn(),
}));

import { GenerateSettlementForm } from "@/features/settlements/components/generate-settlement-form";

const render = () =>
  renderToStaticMarkup(
    createElement(GenerateSettlementForm, { partners: [{ value: "p-1", label: "Demo (DEMO)" }] }),
  );

describe("GenerateSettlementForm", () => {
  it("should offer the partner and the month with their labels (AC01)", () => {
    const html = render();

    expect(html).toContain('for="partner_id">Partner<');
    expect(html).toContain('for="month">Month<');
  });

  it("should use the month picker, empty until a month is chosen", () => {
    const html = render();

    expect(html).toContain('data-slot="month-picker-trigger"');
    expect(html).toContain("Pick a month");
  });

  it("should start with no month chosen and have a Generate button", () => {
    const html = render();

    expect(html).toContain(">Generate<");
    expect(html).not.toMatch(/id="month"[^>]*value="\d/);
  });
});
