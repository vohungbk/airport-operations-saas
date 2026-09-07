import { describe, expect, it } from "vitest";

import { airportsQuerySchema } from "@/features/airports/schemas/airports-query.schema";

describe("airportsQuerySchema", () => {
  it("should parse valid params", () => {
    const result = airportsQuerySchema.safeParse({
      q: "dubai",
      sort: "name",
      order: "asc",
      page: "2",
      page_size: "10",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        q: "dubai",
        sort: "name",
        order: "asc",
        page: 2,
        page_size: 10,
      });
    }
  });

  it("should fall back to defaults for every field when no params are given", () => {
    const result = airportsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        q: undefined,
        sort: "code",
        order: "asc",
        page: 1,
        page_size: 20,
      });
    }
  });

  it("should fall back to page 1 when page is out of range (0 or negative)", () => {
    const result = airportsQuerySchema.safeParse({ page: "0" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
  });

  it("should clamp page_size back to the default when it exceeds the max", () => {
    const result = airportsQuerySchema.safeParse({ page_size: "9999" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page_size).toBe(20);
    }
  });

  it("should fall back to the default sort column when given a column outside the allowlist", () => {
    const result = airportsQuerySchema.safeParse({ sort: "timezone" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe("code");
    }
  });

  it("should treat an empty search string as no search", () => {
    const result = airportsQuerySchema.safeParse({ q: "" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBeUndefined();
    }
  });

  it("should fall back to the default order when given an invalid order value", () => {
    const result = airportsQuerySchema.safeParse({ order: "sideways" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.order).toBe("asc");
    }
  });
});
