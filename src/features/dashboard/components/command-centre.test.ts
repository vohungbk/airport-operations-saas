import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CommandCentre } from "@/features/dashboard/components/command-centre";
import { DASHBOARD_CHARTS } from "@/features/dashboard/lib/dashboard-charts";
import type { FlightAlertItem } from "@/features/dashboard/lib/get-flight-alerts";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element);

const chartResult = (
  id: string,
  values: (number | null)[],
): DashboardChartResult => {
  const chart = DASHBOARD_CHARTS.find((c) => c.id === id)!;

  return {
    chart,
    bars: chart.categories.map((category, index) => ({
      category,
      value: index < values.length ? values[index] : 0,
    })),
  };
};

const render = (props: Partial<Parameters<typeof CommandCentre>[0]> = {}) =>
  html(
    createElement(CommandCentre, {
      charts: [],
      flightAlerts: [],
      stock: [],
      ...props,
    }),
  );

describe("Command Centre tiles (UI-F06-S04, R7)", () => {
  it("should show the four tiles of the design", () => {
    const out = render();

    for (const label of [
      "Arrivals today",
      "Installations due",
      "Active rentals",
      "Overdue tasks",
    ]) {
      expect(out).toContain(label);
    }
  });

  it("should show a dash, never a made-up number, until the formulas are built", () => {
    const out = render();

    expect(out.match(/>—</g)?.length).toBeGreaterThanOrEqual(4);
    expect(out).not.toContain(">0<");
  });

  it("should add nothing that is not in the design", () => {
    const out = render();

    expect(out).not.toContain("All counts");
    expect(out).not.toContain("Not available yet");
    expect(out).not.toContain("Export report");
  });
});

describe("Command Centre banners", () => {
  const alerts: FlightAlertItem[] = [
    {
      id: "f-1",
      flight_number: "EK 203",
      kind: "early",
      minutes: 45,
      arrival_label: "15:45 GMT+4",
      booking_number: "BK-2026-000123",
    },
    {
      id: "f-2",
      flight_number: "EK 215",
      kind: "delayed",
      minutes: 50,
      arrival_label: "19:20 GMT+4",
      booking_number: null,
    },
  ];

  it("should show a blue banner for an early flight and an amber one for a late flight, as the design does", () => {
    const out = render({ flightAlerts: alerts });

    expect(out).toContain("ARRIVING 45 MINUTES EARLY");
    expect(out).toContain("DELAYED 50 MINUTES");
    expect(out).toContain("bg-info-bg");
    expect(out).toContain("bg-warning-bg");
  });

  it("should write the flight, the new arrival and the booking under the title", () => {
    const out = render({ flightAlerts: alerts });

    expect(out).toContain("EK 203 · New arrival 15:45 GMT+4 · BK-2026-000123");
    expect(out).toContain("EK 215 · Arrival 19:20 GMT+4");
  });

  it("should not write a deadline that is not stored", () => {
    const out = render({ flightAlerts: alerts });

    expect(out).not.toContain("DEADLINE MOVED");
    expect(out).not.toContain("Installation deadline");
  });

  it("should show no banner when no flight is early or late", () => {
    expect(render()).not.toContain("Flight alerts");
  });
});

describe("Command Centre charts (UI-F06-S05, R7)", () => {
  it("should draw only the charts the role has", () => {
    const out = render({
      charts: [chartResult("bookings_by_status", [18, 9, 11, 2])],
    });

    expect(out).toContain("Bookings by status");
    expect(out).not.toContain("Seats by status");
    expect(out).not.toContain("Jobs by status");
  });

  it("should draw each chart in the frame of the chart components, with a legend and the table switch", () => {
    const out = render({
      charts: [
        chartResult("seats_by_status", [16, 6, 12, 2, 2, 2, 0]),
        chartResult("bookings_by_status", [18, 9, 11, 2]),
        chartResult("jobs_by_status", [3, 2, 1, 4]),
        chartResult("open_incidents_by_severity", [0, 1, 3, 2]),
      ],
      stock: [{ label: "Convertible", value: 16 }],
    });

    expect(out.match(/data-slot="chart-frame"/g)).toHaveLength(5);
    expect(out.match(/data-slot="chart-legend"/g)).toHaveLength(5);
    expect(out.match(/View as table/g)).toHaveLength(5);
  });

  it("should show the chart error with a retry, not zeros, when a count could not be read", () => {
    const out = render({
      charts: [chartResult("jobs_by_status", [null, 2, 3, 1])],
    });

    expect(out).toContain("This chart could not be loaded.");
    expect(out).toContain("Retry");
    expect(out).not.toContain('data-slot="chart-legend"');
  });

  it("should say there is nothing to chart when every count is zero, not draw zeros", () => {
    const out = render({
      charts: [chartResult("open_incidents_by_severity", [0, 0, 0, 0])],
    });

    expect(out).toContain("No data to chart yet.");
    expect(out).not.toContain('data-slot="chart-legend"');
  });

  it("should show the stock by category next to the seats chart, and the chart error when it could not be read", () => {
    const seats = chartResult("seats_by_status", [16, 6, 12, 2, 2, 2, 0]);
    const ready = render({
      charts: [seats],
      stock: [{ label: "Convertible", value: 16 }],
    });
    const failed = render({ charts: [seats], stock: null });

    expect(ready).toContain("Stock by category");
    expect(ready).toContain("Convertible");
    expect(failed).toContain("Stock by category");
    expect(failed).toContain("This chart could not be loaded.");
  });

  it("should say there is nothing to chart when the stock is empty", () => {
    const out = render({
      charts: [chartResult("seats_by_status", [1, 0, 0, 0, 0, 0, 0])],
      stock: [],
    });

    expect(out).toContain("No data to chart yet.");
  });

  it("should not draw a chart by hand in the dashboard components", () => {
    for (const file of ["status-chart.tsx", "stock-by-category.tsx"]) {
      const source = readFileSync(
        join(process.cwd(), "src/features/dashboard/components", file),
        "utf8",
      );

      expect(source).toContain("@/components/charts/");
      expect(source).not.toContain("<svg");
      expect(source).not.toContain("<circle");
      expect(source).not.toContain("style={{");
    }
  });
});

describe("Operational attention", () => {
  it("should list the nine queues of the design, each with a dash for its next item and status", () => {
    const out = render();

    for (const queue of [
      "Today&#x27;s arrivals",
      "Upcoming bookings",
      "Cleaning queue",
      "Damaged or quarantined",
      "Overdue tasks",
    ]) {
      expect(out).toContain(queue);
    }
    expect(out.match(/data-label="Queue"/g)).toHaveLength(9);
    expect(out).toContain('data-stacked=""');
  });
});

describe("Command Centre chart style", () => {
  const charts = [
    chartResult("seats_by_status", [16, 6, 12, 2, 2, 2, 0]),
    chartResult("bookings_by_status", [18, 9, 11, 2]),
    chartResult("open_incidents_by_severity", [0, 1, 3, 2]),
  ];

  it("should paint the ring and the stacked bar in solid colors, with no hatch or dot pattern", () => {
    const out = render({ charts });

    expect(out).not.toContain("<pattern");
    expect(out).not.toContain("url(#");
    expect(out).toContain("var(--chart-1)");
  });

  it("should put a symbol before each name in the legend of the ring and the stacked bar", () => {
    const out = render({ charts });

    expect(out).toContain("● Available");
    expect(out).toContain("◆ Active rental");
    expect(out).toContain("● Low");
    expect(out).toContain("◆ Medium");
  });
});

describe("Command Centre chart content", () => {
  it("should group the seats as the ring of the design does, and leave the retired ones out", () => {
    const out = render({
      charts: [chartResult("seats_by_status", [16, 6, 12, 2, 2, 2, 9])],
    });

    expect(out).toContain("Active rental");
    expect(out).toContain("Cleaning / inspection");
    expect(out).not.toContain("Retired");
    expect(out).toContain(">40<");
  });

  it("should list the severities from the lightest to the heaviest with their counts", () => {
    const out = render({
      charts: [chartResult("open_incidents_by_severity", [0, 1, 3, 2])],
    });

    expect(out.indexOf("Low")).toBeLessThan(out.indexOf("Medium"));
    expect(out.indexOf("Medium")).toBeLessThan(out.indexOf("High"));
    expect(out.indexOf("High")).toBeLessThan(out.indexOf("Critical"));
  });
});
