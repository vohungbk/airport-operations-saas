import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChartMarker } from "@/components/charts/chart-markers";
import { DonutChart, type DonutChartProps } from "@/components/charts/donut-chart";
import { LineTrendChart, type LineTrendChartProps } from "@/components/charts/line-chart";
import { SERIES_MARKERS, seriesColor } from "@/lib/charts/chart-tokens";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const donut = (over: Partial<DonutChartProps> = {}) =>
  html(
    createElement(DonutChart, {
      title: "Seats by status",
      status: "ready",
      series_name: "Seats",
      items: [
        { label: "Available", value: 120 },
        { label: "Reserved", value: 73 },
      ],
      ...over,
    }),
  );

const months = (...values: (number | null)[]) => [
  { name: "Net", points: values.map((value, i) => ({ label: `M${i + 1}`, value })) },
];

const line = (over: Partial<LineTrendChartProps> = {}) =>
  html(createElement(LineTrendChart, { title: "Revenue by month", status: "ready", series: months(120, 135, 90), ...over }));

describe("DonutChart", () => {
  it("should show the total in the middle", () => {
    const out = donut();
    expect(out).toContain('data-slot="donut-total"');
    expect(out).toMatch(/data-slot="donut-total"[^>]*>.*>193</);
    expect(out).toContain("Total");
  });

  it("should write every slice with its value and share for a screen reader, and the total", () => {
    expect(donut()).toContain('aria-label="Seats by status: Available 120 (62%), Reserved 73 (38%); total 193"');
  });

  it("should give the legend a name, a value and a share for each slice", () => {
    const out = donut();
    expect(out).toContain('data-slot="chart-legend"');
    expect(out).toContain("Available");
    expect(out).toContain("120 · 62%");
    expect(out).toContain("73 · 38%");
  });

  it("should show the pattern of each slice in the legend, as well as its color (R7)", () => {
    expect(donut()).toContain("<pattern");
  });

  it("should offer the same numbers as a table", () => {
    expect(donut()).toContain("View as table");
  });

  it("should draw one slice as the whole ring without an error (E1)", () => {
    const out = donut({ items: [{ label: "Available", value: 5 }] });
    expect(out).toContain('data-state="ready"');
    expect(out).toContain("Available 5 (100%)");
  });

  it("should list a slice of 0 in the legend", () => {
    expect(donut({ items: [{ label: "Retired", value: 0 }, { label: "Available", value: 4 }] })).toContain("0 · 0%");
  });

  it("should say there is no data, not draw a ring of zeros", () => {
    const out = donut({ items: [{ label: "A", value: 0 }, { label: "B", value: 0 }] });
    expect(out).toContain("No data to chart yet.");
    expect(out).not.toContain('data-slot="donut-total"');
  });

  it("should draw with a note when a value is missing", () => {
    const out = donut({ items: [{ label: "A", value: 5 }, { label: "B", value: null }] });
    expect(out).toContain('data-slot="chart-gap-note"');
  });

  it("should shorten a very large total in the middle and keep the full number for the screen reader (E3)", () => {
    const out = donut({ items: [{ label: "Revenue", value: 1_250_000 }] });
    expect(out).toMatch(/data-slot="donut-total"[^>]*>.*>1\.3M</);
    expect(out).toContain("1,250,000");
  });

  it("should not show the data to a person who has no access", () => {
    const out = donut({ status: "forbidden" });
    expect(out).toContain("You do not have access to this chart.");
    expect(out).not.toContain("Available");
  });

  it("should show a loading state without the data", () => {
    const out = donut({ status: "loading" });
    expect(out).toContain('data-slot="chart-loading"');
    expect(out).not.toContain("193");
  });
});

describe("LineTrendChart", () => {
  it("should write every month with its full value for a screen reader", () => {
    expect(line()).toContain('aria-label="Revenue by month: Net: M1 120, M2 135, M3 90"');
  });

  it("should show the title, a legend with the marker of each line and a switch to the table", () => {
    const out = line({ series: [...months(1, 2), { name: "Gross", points: [{ label: "M1", value: 3 }, { label: "M2", value: 4 }] }] });
    expect(out).toContain("Revenue by month");
    expect(out).toContain('data-slot="chart-legend"');
    expect(out).toContain('data-marker="circle"');
    expect(out).toContain('data-marker="square"');
    expect(out).toContain("View as table");
  });

  it("should draw one month without an error (E1)", () => {
    const out = line({ series: months(50) });
    expect(out).toContain('data-state="ready"');
    expect(out).toContain("M1 50");
  });

  it("should draw twelve months", () => {
    const out = line({ series: months(...Array.from({ length: 12 }, (_, i) => i + 1)) });
    expect(out).toContain('data-state="ready"');
    expect(out).toContain("M12 12");
  });

  it("should draw with a note when a month is missing, and say no data for it", () => {
    const out = line({ series: months(10, null, 30) });
    expect(out).toContain('data-slot="chart-gap-note"');
    expect(out).toContain("M2 no data");
  });

  it("should say there is no data, not draw a line of zeros", () => {
    const out = line({ series: months(0, 0, 0) });
    expect(out).toContain("No data to chart yet.");
    expect(out).not.toContain('role="img"');
  });

  it("should keep the full number for the screen reader when a point shows 1.3M (E3)", () => {
    expect(line({ series: months(1_250_000, 90) })).toContain("M1 1,250,000");
  });

  it("should not show the data to a person who has no access", () => {
    const out = line({ status: "forbidden" });
    expect(out).toContain("You do not have access to this chart.");
    expect(out).not.toContain("M1 ");
  });

  it("should show an error with a retry button", () => {
    expect(line({ status: "error" })).toContain("Retry");
  });
});

describe("ChartMarker", () => {
  it.each(SERIES_MARKERS)("should draw the %s marker in the color it is given", (marker) => {
    const out = html(createElement("svg", null, createElement(ChartMarker, { marker, x: 10, y: 20, color: seriesColor(2) })));
    expect(out).toContain(`data-marker="${marker}"`);
    expect(out).toContain('transform="translate(10 20)"');
    expect(out).toContain(seriesColor(2));
  });
});
