import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { IncidentsSearch } from "@/features/incidents/components/incidents-search";
import { getIncidentSearchError, INCIDENT_SEARCH_MAX_LENGTH, INCIDENT_SEARCH_TOO_LONG_MESSAGE } from "@/features/incidents/lib/incident-search";

describe("IncidentsSearch", () => {
  it("should render the search field with the current search and no error", () => {
    const html = renderToStaticMarkup(
      createElement(IncidentsSearch, {
        query: { q: "strap", sort: "created_at", order: "desc", page: 1, page_size: 20 },
      }),
    );

    expect(html).toContain('aria-label="Search incidents"');
    expect(html).toContain('value="strap"');
    expect(html).not.toContain('role="alert"');
  });
});

describe("getIncidentSearchError", () => {
  it("should accept a value of exactly the maximum length", () => {
    expect(getIncidentSearchError("x".repeat(INCIDENT_SEARCH_MAX_LENGTH))).toBeNull();
  });

  it("should return the message for a value one character over", () => {
    expect(getIncidentSearchError("x".repeat(INCIDENT_SEARCH_MAX_LENGTH + 1))).toBe(
      INCIDENT_SEARCH_TOO_LONG_MESSAGE,
    );
  });

  it("should not count the spaces around the value", () => {
    expect(
      getIncidentSearchError(`  ${"x".repeat(INCIDENT_SEARCH_MAX_LENGTH)}  `),
    ).toBeNull();
  });
});
