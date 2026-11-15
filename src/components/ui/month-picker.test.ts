import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonthGrid, MonthPicker } from "@/components/ui/month-picker";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe("MonthPicker", () => {
  it("should show the placeholder when there is no value", () => {
    expect(html(createElement(MonthPicker, { placeholder: "All periods" }))).toContain("All periods");
  });

  it("should show the picked month as text and keep it 44 px high", () => {
    const out = html(createElement(MonthPicker, { value: "2026-11" }));
    expect(out).toContain("Nov 2026");
    expect(out).toContain("h-11");
  });

  it("should render disabled", () => {
    expect(html(createElement(MonthPicker, { disabled: true }))).toContain("disabled");
  });
});

describe("MonthGrid", () => {
  it("should show 12 months with the picked one pressed", () => {
    const out = html(createElement(MonthGrid, { value: "2026-11" }));
    expect(out.match(/aria-pressed=/g)).toHaveLength(12);
    expect(out.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("should disable the months outside min and max", () => {
    const out = html(createElement(MonthGrid, { value: "2026-11", min: "2026-03", max: "2026-09" }));
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-label="2026-02"/);
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*aria-label="2026-10"/);
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*aria-label="2026-05"/);
  });
});
