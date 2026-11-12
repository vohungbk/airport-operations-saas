import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/incidents",
}));

import { IncidentsFilters } from "@/features/incidents/components/incidents-filters";
import {
  getIncidentSearchError,
  INCIDENT_SEARCH_MAX_LENGTH,
  INCIDENT_SEARCH_TOO_LONG_MESSAGE,
} from "@/features/incidents/lib/incident-search";
import type { IncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

const QUERY: IncidentsQuery = {
  q: undefined,
  status: undefined,
  severity: undefined,
  seat_id: undefined,
  from: undefined,
  to: undefined,
  sort: "created_at",
  order: "desc",
  page: 1,
  page_size: 20,
};

function render(query: IncidentsQuery = QUERY) {
  return renderToStaticMarkup(
    createElement(IncidentsFilters, {
      query,
      seats: [{ id: "s-1", serial_number: "SEAT-0001" }],
      timeZone: "Asia/Dubai",
      clearHref: "/incidents",
    }),
  );
}

describe("IncidentsFilters", () => {
  it("should render the search field with the current search and no error", () => {
    const html = render({ ...QUERY, q: "strap" });

    expect(html).toContain('id="incident-search"');
    expect(html).toContain('value="strap"');
    expect(html).not.toContain('role="alert"');
  });

  it("should render the status and severity filters defaulting to all", () => {
    const html = render();

    expect(html).toContain('aria-label="Filter by status"');
    expect(html).toContain('aria-label="Filter by severity"');
    expect(html).toContain('aria-label="Filter by seat"');
    expect(html.match(/hidden-input"[^>]*value="all"/g)).toHaveLength(3);
  });

  it("should select the chosen status and severity", () => {
    const html = render({
      ...QUERY,
      status: "investigating",
      severity: "critical",
    });

    expect(html).toMatch(/hidden-input"[^>]*value="investigating"/);
    expect(html).toMatch(/hidden-input"[^>]*value="critical"/);
    // Only the seat filter is left on All.
    expect(html.match(/hidden-input"[^>]*value="all"/g)).toHaveLength(1);
  });
});

describe("getIncidentSearchError", () => {
  it("should accept a value of exactly the maximum length", () => {
    expect(
      getIncidentSearchError("x".repeat(INCIDENT_SEARCH_MAX_LENGTH)),
    ).toBeNull();
  });

  it("should return the message for a value one character over", () => {
    expect(
      getIncidentSearchError("x".repeat(INCIDENT_SEARCH_MAX_LENGTH + 1)),
    ).toBe(INCIDENT_SEARCH_TOO_LONG_MESSAGE);
  });

  it("should not count the spaces around the value", () => {
    expect(
      getIncidentSearchError(`  ${"x".repeat(INCIDENT_SEARCH_MAX_LENGTH)}  `),
    ).toBeNull();
  });
});
