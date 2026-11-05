import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { FlightBoardFilters } from "./flight-board-filters";

const AIRPORTS = [
  { value: "a1", label: "DXB" },
  { value: "a2", label: "AUH" },
];

const render = (props: Partial<Parameters<typeof FlightBoardFilters>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(FlightBoardFilters, {
      query: { airport_id: "a1" },
      airports: AIRPORTS,
      sourceLabel: "Simulator",
      lastSyncLabel: "Last sync 14:02 GST",
      ...props,
    }),
  );

describe("FlightBoardFilters", () => {
  it("should label the airport and the status selects", () => {
    const html = render();

    expect(html).toMatch(/<label[^>]*for="flight-board-airport"[^>]*>Airport<\/label>/);
    expect(html).toMatch(/<label[^>]*for="flight-board-status"[^>]*>Status<\/label>/);
  });

  it("should show the chosen airport and All statuses when no status is chosen", () => {
    const html = render();

    expect(html).toContain("DXB");
    expect(html).toContain("All statuses");
  });

  it("should show the status that is chosen", () => {
    expect(render({ query: { airport_id: "a1", status: "landed" } })).toContain("Landed");
  });

  it("should show the source and the last sync, and a Clear filters link to the plain board", () => {
    const html = render();

    expect(html).toContain("Simulator");
    expect(html).toContain("Last sync 14:02 GST");
    expect(html).toMatch(/<a[^>]*href="\/flights"[^>]*>Clear filters<\/a>/);
  });

  it("should leave the source out when the configuration is not valid", () => {
    expect(render({ sourceLabel: null })).not.toContain("Last sync");
  });
});
