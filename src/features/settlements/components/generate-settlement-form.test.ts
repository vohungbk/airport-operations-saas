import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settlements/actions/generate-settlement.action", () => ({
  generateSettlementAction: vi.fn(),
}));

import { GenerateSettlementForm } from "@/features/settlements/components/generate-settlement-form";
import { currentMonth } from "@/features/settlements/schemas/settlement.schema";

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

  it("should use a month picker that cannot go past the current month", () => {
    const html = render();

    expect(html).toContain('type="month"');
    expect(html).toContain(`max="${currentMonth()}"`);
  });

  it("should start with no month chosen and have a Generate button", () => {
    const html = render();

    expect(html).toContain(">Generate<");
    expect(html).not.toMatch(/id="month"[^>]*value="\d/);
  });
});
