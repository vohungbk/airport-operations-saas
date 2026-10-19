import { describe, expect, it } from "vitest";

import {
  INCIDENT_SEARCH_MAX_LENGTH,
  INCIDENT_SEARCH_TOO_LONG_MESSAGE,
} from "@/features/incidents/lib/incident-search";
import { parseIncidentsQuery } from "@/features/incidents/schemas/incidents-query.schema";

describe("parseIncidentsQuery", () => {
  it("should use the defaults when there is no query string", () => {
    const { query, search_error } = parseIncidentsQuery({});

    expect(query).toEqual({
      q: undefined,
      sort: "created_at",
      order: "desc",
      page: 1,
      page_size: 20,
    });
    expect(search_error).toBeNull();
  });

  it("should accept a search of exactly the maximum length", () => {
    const q = "x".repeat(INCIDENT_SEARCH_MAX_LENGTH);

    const { query, search_error } = parseIncidentsQuery({ q });

    expect(query.q).toBe(q);
    expect(search_error).toBeNull();
  });

  it("should reject a search one character over the maximum with a clear message", () => {
    const q = "x".repeat(INCIDENT_SEARCH_MAX_LENGTH + 1);

    const { query, search_error } = parseIncidentsQuery({ q });

    expect(query.q).toBeUndefined();
    expect(search_error).toBe(INCIDENT_SEARCH_TOO_LONG_MESSAGE);
  });

  it.each([[""], ["   "]])(
    "should treat the blank search %j as no search without an error",
    (q) => {
      const { query, search_error } = parseIncidentsQuery({ q });

      expect(query.q).toBeUndefined();
      expect(search_error).toBeNull();
    },
  );

  it("should trim the search", () => {
    expect(parseIncidentsQuery({ q: "  strap  " }).query.q).toBe("strap");
  });

  it.each([["description"], ["created_at;drop table incidents"], [""]])(
    "should fall back to the default sort for the column %j outside the allowlist",
    (sort) => {
      expect(parseIncidentsQuery({ sort }).query.sort).toBe("created_at");
    },
  );

  it.each([["severity"], ["status"], ["created_at"]])(
    "should accept the sort column %s",
    (sort) => {
      expect(parseIncidentsQuery({ sort }).query.sort).toBe(sort);
    },
  );

  it.each([["0"], ["-3"], ["abc"], ["1.5"]])(
    "should fall back to page 1 for the page %j",
    (page) => {
      expect(parseIncidentsQuery({ page }).query.page).toBe(1);
    },
  );

  it("should fall back to the default page size when it is above the maximum", () => {
    expect(parseIncidentsQuery({ page_size: "101" }).query.page_size).toBe(20);
  });
});
