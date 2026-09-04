import { describe, expect, it } from "vitest";

import { partnersQuerySchema } from "@/features/partners/schemas/partners-query.schema";

describe("partnersQuerySchema", () => {
  it("should parse valid params", () => {
    const result = partnersQuerySchema.safeParse({
      q: "emirates",
      status: "active",
      sort: "name",
      order: "asc",
      page: "2",
      page_size: "10",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        q: "emirates",
        status: "active",
        sort: "name",
        order: "asc",
        page: 2,
        page_size: 10,
      });
    }
  });

  it("should fall back to defaults for every field when no params are given", () => {
    const result = partnersQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        q: undefined,
        status: undefined,
        sort: "created_at",
        order: "desc",
        page: 1,
        page_size: 20,
      });
    }
  });

  it("should fall back to page 1 when page is out of range (0 or negative)", () => {
    const result = partnersQuerySchema.safeParse({ page: "0" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
    }
  });

  it("should clamp page_size back to the default when it exceeds the max", () => {
    const result = partnersQuerySchema.safeParse({ page_size: "9999" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page_size).toBe(20);
    }
  });

  it("should fall back to the default sort column when given a column outside the allowlist", () => {
    const result = partnersQuerySchema.safeParse({ sort: "contact_email" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort).toBe("created_at");
    }
  });

  it("should ignore an invalid status instead of failing the whole query", () => {
    const result = partnersQuerySchema.safeParse({ status: "not-a-status" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });

  it("should treat an empty search string as no search", () => {
    const result = partnersQuerySchema.safeParse({ q: "" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBeUndefined();
    }
  });
});
