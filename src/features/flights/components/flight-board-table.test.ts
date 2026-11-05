import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FlightBoardRow } from "@/features/flights/lib/flight-board";

import { FlightBoardTable } from "./flight-board-table";

const ROW: FlightBoardRow = {
  key: "f1:b1",
  booking_id: "b1",
  booking_number: "BK-2026-000123",
  flight_number: "EK 203",
  status: "scheduled",
  scheduled: { date: "24 Oct", time: "16:30 GST" },
  estimated: { date: "24 Oct", time: "15:45 GST" },
  change: { kind: "early", minutes: 45, label: "Early 45 min" },
  priority: "high",
  deadline: { date: "24 Oct", time: "14:45 GST" },
  deadline_moved: true,
  stale_label: null,
};

const render = (rows: FlightBoardRow[]) => renderToStaticMarkup(createElement(FlightBoardTable, { rows }));

describe("FlightBoardTable", () => {
  it("should show the eight columns of the design", () => {
    const html = render([ROW]);

    for (const column of ["Flight", "Booking", "Scheduled", "Estimated", "Change", "Priority", "Installation deadline", "Status"]) {
      expect(html).toContain(`>${column}</th>`);
    }
  });

  it("should open the booking of the row from the flight number", () => {
    const html = render([ROW]);

    expect(html).toContain('href="/bookings/b1"');
    expect(html).toContain('aria-label="View booking BK-2026-000123"');
  });

  it("should write the change and the priority with text as well as an icon", () => {
    const html = render([ROW]);

    expect(html).toContain("Early 45 min");
    expect(html).toContain("High");
    expect(html).toContain("16:30 GST");
    expect(html).toContain("14:45 GST");
  });

  it("should show a dash for an estimate and a deadline that are not stored", () => {
    const html = render([
      { ...ROW, estimated: null, deadline: null, priority: "normal", change: { kind: "cancelled", minutes: null, label: "Cancelled" } },
    ]);

    expect(html).toContain("Normal");
    expect(html).toContain("Cancelled");
    expect(html.match(/<span>-<\/span>/g)).toHaveLength(2);
  });

  it("should show the stale tag under the flight only when the row has one", () => {
    expect(render([{ ...ROW, stale_label: "Stale · 25 min" }])).toContain("Stale · 25 min");
    expect(render([ROW])).not.toContain("Stale");
  });
});
