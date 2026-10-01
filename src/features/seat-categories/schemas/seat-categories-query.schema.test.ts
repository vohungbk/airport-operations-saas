import { describe, expect, it } from "vitest";

import { seatCategoriesQuerySchema } from "@/features/seat-categories/schemas/seat-categories-query.schema";

describe("seatCategoriesQuerySchema", () => {
  it("should apply defaults for an empty query", () => {
    expect(seatCategoriesQuerySchema.parse({})).toEqual({
      q: undefined,
      status: undefined,
      sort: "name",
      order: "asc",
      page: 1,
      page_size: 20,
    });
  });

  it("should accept a valid sort column, order, status and page", () => {
    const result = seatCategoriesQuerySchema.parse({
      q: " booster ",
      status: "inactive",
      sort: "max_child_age",
      order: "desc",
      page: "3",
    });

    expect(result).toMatchObject({
      q: "booster",
      status: "inactive",
      sort: "max_child_age",
      order: "desc",
      page: 3,
    });
  });

  it("should fall back to the default sort when sort is not in the whitelist", () => {
    expect(seatCategoriesQuerySchema.parse({ sort: "id; drop table" }).sort).toBe(
      "name",
    );
  });

  it("should ignore an unknown status", () => {
    expect(
      seatCategoriesQuerySchema.parse({ status: "deleted" }).status,
    ).toBeUndefined();
  });

  it("should fall back to page 1 for a non-positive or garbled page", () => {
    expect(seatCategoriesQuerySchema.parse({ page: "0" }).page).toBe(1);
    expect(seatCategoriesQuerySchema.parse({ page: "abc" }).page).toBe(1);
  });

  it("should fall back to the default page size when above the max", () => {
    expect(seatCategoriesQuerySchema.parse({ page_size: "1000" }).page_size).toBe(
      20,
    );
  });

  it("should treat a blank q as undefined", () => {
    expect(seatCategoriesQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });
});
