import { describe, expect, it } from "vitest";

import {
  getTechnicianSearchError,
  TECHNICIAN_SEARCH_MAX_LENGTH,
  TECHNICIAN_SEARCH_TOO_LONG_MESSAGE,
} from "@/features/technicians/lib/technician-search";
import {
  parseTechniciansQuery,
  technicianIdSchema,
} from "@/features/technicians/schemas/technicians-query.schema";

describe("parseTechniciansQuery", () => {
  it("should apply defaults when no params are given", () => {
    const { query, search_error } = parseTechniciansQuery({});

    expect(search_error).toBeNull();
    expect(query).toEqual({
      q: undefined,
      sort: "full_name",
      order: "asc",
      page: 1,
      page_size: 20,
    });
  });

  it("should accept a search value of exactly the maximum length", () => {
    const q = "a".repeat(TECHNICIAN_SEARCH_MAX_LENGTH);

    const { query, search_error } = parseTechniciansQuery({ q });

    expect(search_error).toBeNull();
    expect(query.q).toBe(q);
  });

  it("should reject a search value one character over the maximum with a clear message", () => {
    const q = "a".repeat(TECHNICIAN_SEARCH_MAX_LENGTH + 1);

    const { query, search_error } = parseTechniciansQuery({ q });

    expect(search_error).toBe(TECHNICIAN_SEARCH_TOO_LONG_MESSAGE);
    expect(query.q).toBeUndefined();
  });

  it("should treat an empty or whitespace-only search as no search", () => {
    expect(parseTechniciansQuery({ q: "" }).query.q).toBeUndefined();
    expect(parseTechniciansQuery({ q: "   " }).query.q).toBeUndefined();
  });

  it("should trim the search value", () => {
    expect(parseTechniciansQuery({ q: "  ali  " }).query.q).toBe("ali");
  });

  it("should fall back to defaults for an unknown sort column or bad page", () => {
    const { query } = parseTechniciansQuery({
      sort: "role; drop table users",
      order: "sideways",
      page: "-3",
      page_size: "9999",
    });

    expect(query.sort).toBe("full_name");
    expect(query.order).toBe("asc");
    expect(query.page).toBe(1);
    expect(query.page_size).toBe(20);
  });
});

describe("getTechnicianSearchError", () => {
  it("should return the shared message when the value is too long", () => {
    expect(
      getTechnicianSearchError("a".repeat(TECHNICIAN_SEARCH_MAX_LENGTH + 1)),
    ).toBe(TECHNICIAN_SEARCH_TOO_LONG_MESSAGE);
  });

  it("should return null at the maximum length", () => {
    expect(
      getTechnicianSearchError("a".repeat(TECHNICIAN_SEARCH_MAX_LENGTH)),
    ).toBeNull();
  });

  it("should ignore surrounding whitespace when measuring length", () => {
    expect(
      getTechnicianSearchError(` ${"a".repeat(TECHNICIAN_SEARCH_MAX_LENGTH)} `),
    ).toBeNull();
  });
});

describe("technicianIdSchema", () => {
  it("should accept a guid and reject other strings", () => {
    expect(
      technicianIdSchema.safeParse("e0000000-0000-0000-0000-000000000001")
        .success,
    ).toBe(true);
    expect(technicianIdSchema.safeParse("not-an-id").success).toBe(false);
  });
});
