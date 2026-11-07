import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({ error: null as string | null }));

vi.mock("@/features/kpi/hooks/use-kpi-period-picker", () => ({
  useKpiPeriodPicker: () => ({ error: hookState.error, choose: vi.fn(), chooseCompare: vi.fn(), search: vi.fn(), clear: vi.fn() }),
}));

import { KpiPeriodPicker } from "@/features/kpi/components/kpi-period-picker";

const OPTIONS = [
  { value: "current", label: "Current month" },
  { value: "ytd", label: "Year to date" },
  { value: "2026-10", label: "October 2026" },
];

const render = (selected: string, compare_label: string | null = "September 2026", query = "") =>
  renderToStaticMarkup(
    createElement(KpiPeriodPicker, { selected, options: OPTIONS, compare_label, compare_on: true, query }),
  );

describe("KpiPeriodPicker (VI-F05-S01, F1)", () => {
  it("should show one dropdown for the period and a Clear all button, as the design draws it", () => {
    hookState.error = null;
    const html = render("current");

    expect(html).toContain('aria-label="Period"');
    expect(html).toContain("Clear all");
    expect(html).not.toContain('type="month"');
  });

  it("should show the search box, as the design draws it, with the search of the address in it", () => {
    hookState.error = null;
    const html = render("current", "September 2026", "seat");

    expect(html).toContain('placeholder="Search records…"');
    expect(html).toContain('aria-label="Search KPIs"');
    expect(html).toContain('value="seat"');
    expect(html).toContain('role="search"');
  });

  it("should show a comparison dropdown named after the period before", () => {
    hookState.error = null;

    expect(render("2026-10")).toContain('aria-label="Comparison"');
  });

  it("should offer no comparison when there is no period before to compare with", () => {
    hookState.error = null;

    expect(render("current", null)).not.toContain('aria-label="Comparison"');
  });

  it("should show no message while the period is accepted", () => {
    hookState.error = null;

    expect(render("2026-10")).not.toContain('role="alert"');
  });

  it("should show the message and flag the dropdown when the period is refused", () => {
    hookState.error = "Choose a month that is not in the future";

    const html = render("current");

    expect(html).toContain('role="alert"');
    expect(html).toContain("Choose a month that is not in the future");
    expect(html).toContain('aria-invalid="true"');
  });
});
