import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CommandCentre } from "@/features/dashboard/components/command-centre";
import { DASHBOARD_CHARTS } from "@/features/dashboard/lib/dashboard-charts";
import type { FlightAlertItem } from "@/features/dashboard/lib/get-flight-alerts";
import type { DashboardChartResult } from "@/features/dashboard/lib/get-dashboard-charts";

vi.mock("@/features/dashboard/components/dashboard-retry-button", () => ({
  DashboardRetryButton: () => "RETRY_BUTTON",
}));

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
      loadedAt: new Date("2026-10-24T08:00:00Z"),
      ...props,
    }),
  );

describe("Command Centre empty state (VI-F11-S01, AC01)", () => {
  const zero = { arrivalsToday: 0, installationsDue: 0, overdueTasks: 0 };

  it("should say nothing needs attention when every figure is zero and no flight alert is shown", () => {
    expect(render(zero)).toContain("Nothing needs attention today.");
  });

  it("should not say it when a figure could not be read", () => {
    expect(render({ ...zero, overdueTasks: null })).not.toContain("Nothing needs attention today.");
  });

  it("should not say it when a flight alert is shown", () => {
    const alert: FlightAlertItem = {
      id: "f-1",
      flight_number: "EK 203",
      kind: "early",
      minutes: 45,
      arrival_label: "15:45",
      booking_number: null,
      deadline_label: null,
    };

    expect(render({ ...zero, flightAlerts: [alert] })).not.toContain("Nothing needs attention today.");
  });
});

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

describe("Command Centre Overdue tasks tile (UI-F06-T01, AC05)", () => {
  it("should show the number and open the Overdue list", () => {
    const out = render({ overdueTasks: 4 });

    expect(out).toContain('href="/jobs?deadline=overdue"');
    expect(out).toContain('aria-label="Overdue tasks: 4"');
  });

  it("should show 0 when no job is overdue, as a real count", () => {
    expect(render({ overdueTasks: 0 })).toContain('aria-label="Overdue tasks: 0"');
  });

  it("should show a dash and no link when the figure could not be read", () => {
    const out = render({ overdueTasks: null });

    expect(out).not.toContain("/jobs?deadline=overdue");
    expect(out).not.toContain("Overdue tasks: 0");
  });
});

describe("Command Centre Arrivals today and Installations due tiles (VI-F05-T02, AC01, AC02)", () => {
  it("should show the two numbers", () => {
    const out = render({ arrivalsToday: 12, installationsDue: 5 });

    expect(out).toMatch(/Arrivals today<\/p><p[^>]*>12</);
    expect(out).toMatch(/Installations due<\/p><p[^>]*>5</);
  });

  it("should show 0 when nothing arrives or is due, as a real count", () => {
    const out = render({ arrivalsToday: 0, installationsDue: 0 });

    expect(out).toMatch(/Arrivals today<\/p><p[^>]*>0</);
    expect(out).toMatch(/Installations due<\/p><p[^>]*>0</);
  });

  it("should show a dash when a figure could not be read", () => {
    const out = render({ arrivalsToday: null, installationsDue: null });

    expect(out).toMatch(/Arrivals today<\/p><p[^>]*>—</);
    expect(out).toMatch(/Installations due<\/p><p[^>]*>—</);
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
      deadline_label: null,
    },
    {
      id: "f-2",
      flight_number: "EK 215",
      kind: "delayed",
      minutes: 50,
      arrival_label: "19:20 GMT+4",
      booking_number: null,
      deadline_label: "20:10 GMT+4",
    },
  ];

  it("should flag a cancelled flight with the action for operations, in text and not in color alone (VI-F02-S06)", () => {
    const out = render({
      flightAlerts: [
        { id: "f-3", flight_number: "EK 9", kind: "cancelled", minutes: 0, arrival_label: "10:00 GMT+4", booking_number: "BK-9", deadline_label: null },
      ],
    });

    expect(out).toContain("FLIGHT CANCELLED");
    expect(out).toContain("EK 9 · BK-9");
    expect(out).toContain("Operations: replan this booking.");
    expect(out).toContain('data-kind="cancelled"');
  });

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

  it("should say the deadline moved and give the new time when a delay moved it (UI-F06-T01, AC03)", () => {
    const out = render({ flightAlerts: alerts });

    expect(out).toContain("DELAYED 50 MINUTES, DEADLINE MOVED");
    expect(out).toContain("New deadline: 20:10 GMT+4");
  });

  it("should not write a deadline for a flight whose deadline did not move", () => {
    const out = render({ flightAlerts: [alerts[0]] });

    expect(out).not.toContain("DEADLINE MOVED");
    expect(out).not.toContain("New deadline");
  });

  it("should not write a deadline for a delayed flight with no deadline stored", () => {
    const out = render({ flightAlerts: [{ ...alerts[1], deadline_label: null }] });

    expect(out).toContain("DELAYED 50 MINUTES");
    expect(out).not.toContain("DEADLINE MOVED");
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
      stock: [{ label: "Convertible", available: 16, total: 20 }],
    });

    expect(out.match(/data-slot="chart-frame"/g)).toHaveLength(4);
    expect(out.match(/data-slot="chart-legend"/g)).toHaveLength(4);
    expect(out.match(/View as table/g)).toHaveLength(4);
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

  it("should show the stock by category next to the seats chart, and an error when it could not be read", () => {
    const seats = chartResult("seats_by_status", [16, 6, 12, 2, 2, 2, 0]);
    const ready = render({
      charts: [seats],
      stock: [{ label: "Convertible", available: 16, total: 20 }],
    });
    const failed = render({ charts: [seats], stock: null });

    expect(ready).toContain("Stock by category");
    expect(ready).toContain("Convertible");
    expect(failed).toContain("Stock by category");
    expect(failed).toContain("This chart could not be loaded.");
    expect(failed).toContain("RETRY_BUTTON");
  });

  it("should say there is no category when the stock is empty", () => {
    const out = render({
      charts: [chartResult("seats_by_status", [1, 0, 0, 0, 0, 0, 0])],
      stock: [],
    });

    expect(out).toContain("No seat categories yet.");
  });

  it("should not draw a chart by hand in the dashboard components", () => {
    for (const file of ["status-chart.tsx"]) {
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

describe("Command Centre stock by category (VI-F11-S06, AC01)", () => {
  const seats = chartResult("seats_by_status", [16, 6, 12, 2, 2, 2, 0]);
  const stock = [
    { label: "Infant Carrier", available: 10, total: 100 },
    { label: "Convertible", available: 16, total: 80 },
    { label: "Booster", available: 8, total: 0 },
  ];

  it("should show each category with its symbol, its count and the date of the figures", () => {
    const out = render({ charts: [seats], stock });

    expect(out).toContain("● ");
    expect(out).toContain("Infant Carrier");
    expect(out).toMatch(/Convertible<\/span><span[^>]*>16</);
    expect(out).toContain("Legend: symbol + status label · count · 24 Oct 2026");
  });

  it("should show a category with no available seat as 0, not hide it", () => {
    const out = render({ charts: [seats], stock: [{ label: "Booster", available: 0, total: 5 }] });

    expect(out).toMatch(/Booster<\/span><span[^>]*>0</);
    expect(out).toContain('aria-valuenow="0"');
  });

  it("should not show a legend line when the stock could not be read", () => {
    expect(render({ charts: [seats], stock: null })).not.toContain("Legend: symbol");
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
    expect(out.match(/data-label="Queue"/g)).toHaveLength(11);
    expect(out).toContain('data-stacked=""');
  });

  it("should list the arrivals and upcoming bookings with a link to each booking (VI-F11-S02, AC01, AC02)", () => {
    const item = (id: string, status_label: string) => ({
      booking_id: id,
      booking_number: `BK-${id}`,
      status_label,
      arrival_label: "15:45 GMT+4",
    });
    const out = render({
      arrivalQueues: {
        arrivals_today: [item("a1", "Technician Assigned"), item("a2", "New")],
        upcoming_bookings: [item("u1", "Allocated")],
      },
    });

    expect(out).toContain('href="/bookings/a1"');
    expect(out).toContain('href="/bookings/u1"');
    expect(out).toContain("Technician Assigned");
    expect(out).toContain("Allocated");
    expect(out.match(/data-label="Queue"/g)).toHaveLength(12);
  });

  it("should keep a dash for a queue that has no booking", () => {
    const out = render({ arrivalQueues: { arrivals_today: [], upcoming_bookings: [] } });

    expect(out).not.toContain('href="/bookings/');
    expect(out.match(/data-label="Queue"/g)).toHaveLength(11);
  });
});

describe("Operational attention allocation queues (VI-F11-S03, AC01)", () => {
  const empty = { count: 0, next: null };
  const allocationQueues = {
    allocation: {
      count: 3,
      next: { href: "/bookings/bk-1", label: "BK-2026-000131 · Infant Carrier", status_label: "New" },
    },
    installations: {
      count: 2,
      next: { href: "/jobs/job-1", label: "Omar Haddad · Bay C-14 · 15:15 GST", status_label: "Assigned" },
    },
    cleaning: { count: 1, next: { href: "/seats/s-1", label: "SEAT-0018 · Infant", status_label: "Cleaning" } },
    inspection: empty,
  };

  it("should show each queue with its count and a link to its next item, in the eleven rows of the table", () => {
    const out = render({ allocationQueues });

    expect(out).toContain("Seats requiring allocation (3)");
    expect(out).toContain("Installations due (2)");
    expect(out).toContain("Cleaning queue (1)");
    expect(out).toContain('href="/bookings/bk-1"');
    expect(out).toContain('href="/jobs/job-1"');
    expect(out).toContain('href="/seats/s-1"');
    expect(out).toContain("Assigned");
    expect(out.match(/data-label="Queue"/g)).toHaveLength(11);
  });

  it("should show a count of 0 and a dash for a queue with nothing in it", () => {
    const out = render({ allocationQueues });

    expect(out).toContain("Inspection queue (0)");
  });

  it("should show no count, only the plain name and a dash, when the queues could not be read", () => {
    const out = render({ allocationQueues: null });

    expect(out).toContain("Seats requiring allocation");
    expect(out).not.toContain("Seats requiring allocation (");
    expect(out).not.toContain('href="/jobs/');
  });
});

describe("Operational attention active and returned (VI-F11-S04, AC01)", () => {
  const activeReturned = {
    active: {
      count: 12,
      next: { href: "/bookings/bk-9", label: "BK-2026-000140 · Toddler Seat", status_label: "Active Rental" },
    },
    returned: { count: 0, next: null },
  };

  it("should list the active rentals and the returned seats with their counts and a link to the next item", () => {
    const out = render({ activeReturned });

    expect(out).toContain("Active rentals (12)");
    expect(out).toContain("Returned seats (0)");
    expect(out).toContain('href="/bookings/bk-9"');
    expect(out).toContain("Active Rental");
  });

  it("should show the plain names and a dash, with no count, when they could not be read", () => {
    const out = render({ activeReturned: null });

    expect(out).toContain("Active rentals");
    expect(out).not.toContain("Active rentals (");
    expect(out).not.toContain("Returned seats (");
  });
});

describe("Operational attention damaged or quarantined (VI-F11-S05, AC01)", () => {
  it("should show the seats in quarantine with their count and a link to the next seat", () => {
    const out = render({
      quarantineQueue: {
        count: 2,
        next: { href: "/seats/s-7", label: "SEAT-0007 · Infant", status_label: "Quarantine" },
      },
    });

    expect(out).toContain("Damaged or quarantined (2)");
    expect(out).toContain('href="/seats/s-7"');
  });

  it("should show a count of 0 when no seat is in quarantine, and no count when it could not be read", () => {
    expect(render({ quarantineQueue: { count: 0, next: null } })).toContain("Damaged or quarantined (0)");
    expect(render({ quarantineQueue: null })).not.toContain("Damaged or quarantined (");
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
