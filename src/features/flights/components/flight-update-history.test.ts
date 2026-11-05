import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FlightUpdatesResult } from "@/features/flights/lib/get-flight-updates";

import {
  FLIGHT_UPDATES_EMPTY_MESSAGE,
  FLIGHT_UPDATES_ERROR_MESSAGE,
  FlightUpdateHistory,
} from "./flight-update-history";

const ITEMS: FlightUpdatesResult = {
  error: false,
  items: [
    {
      id: "u-3",
      source: "provider",
      occurred_at: "2026-10-24T10:02:00.000Z",
      changes: [{ field: "estimated_arrival_at", from: null, to: "2026-10-24T11:45:00Z" }],
    },
    {
      id: "u-2",
      source: "provider",
      occurred_at: "2026-10-24T09:30:00.000Z",
      changes: [{ field: "terminal", from: null, to: "3" }],
    },
    {
      id: "u-1",
      source: "system",
      occurred_at: "2026-10-24T08:10:00.000Z",
      changes: [{ field: "status", from: null, to: "scheduled" }],
    },
  ],
};

const render = (result: FlightUpdatesResult) =>
  renderToStaticMarkup(createElement(FlightUpdateHistory, { result, timeZone: "Asia/Dubai" }));

describe("FlightUpdateHistory (VI-F02-T01)", () => {
  it("should show the card with the entries in the order given, newest first (AC01)", () => {
    const html = render(ITEMS);

    expect(html).toContain("Flight update history");
    expect(html.indexOf("14:02 · Provider")).toBeGreaterThan(-1);
    expect(html.indexOf("14:02 · Provider")).toBeLessThan(html.indexOf("13:30 · Provider"));
    expect(html.indexOf("13:30 · Provider")).toBeLessThan(html.indexOf("12:10 · System"));
  });

  it("should show for each entry the time, the source, what changed and the date with the time zone (AC02)", () => {
    const html = render(ITEMS);

    expect(html).toContain("14:02 · Provider — Estimated arrival updated to 15:45 GST");
    expect(html).toContain("12:10 · System — Status changed to Scheduled");
    expect(html).toContain("24 Oct 2026 · Asia/Dubai · Audit record retained");
  });

  it("should show an empty state and no error when there is no history (AC04)", () => {
    const html = render({ items: [], error: false });

    expect(html).toContain(FLIGHT_UPDATES_EMPTY_MESSAGE);
    expect(html).not.toContain(FLIGHT_UPDATES_ERROR_MESSAGE);
    expect(html).not.toContain('role="alert"');
  });

  it("should show an error in the card when the history cannot load (AC05)", () => {
    const html = render({ items: [], error: true });

    expect(html).toContain('role="alert"');
    expect(html).toContain(FLIGHT_UPDATES_ERROR_MESSAGE);
    expect(html).not.toContain(FLIGHT_UPDATES_EMPTY_MESSAGE);
  });

  it("should have no edit or delete action and no form (AC07)", () => {
    const html = render(ITEMS);

    expect(html).not.toMatch(/<(button|form|input|textarea|select|a)[\s>]/);
    expect(html.toLowerCase()).not.toMatch(/\b(edit|delete|remove)\b/);
  });
});
