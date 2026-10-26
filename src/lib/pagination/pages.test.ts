import { describe, expect, it } from "vitest";

import { buildPageItems } from "@/lib/pagination/pages";

describe("buildPageItems", () => {
  it("should list every page when there are few", () => {
    expect(buildPageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("should show one page when there are no results", () => {
    expect(buildPageItems(1, 0)).toEqual([1]);
  });

  it("should cut the end with an ellipsis near the first page", () => {
    expect(buildPageItems(1, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 20]);
  });

  it("should cut the start with an ellipsis near the last page", () => {
    expect(buildPageItems(20, 20)).toEqual([1, "ellipsis-start", 16, 17, 18, 19, 20]);
  });

  it("should cut both sides in the middle and keep the current page with its neighbours", () => {
    expect(buildPageItems(10, 20)).toEqual([1, "ellipsis-start", 9, 10, 11, "ellipsis-end", 20]);
  });

  it("should clamp a current page outside the range", () => {
    expect(buildPageItems(99, 20)).toEqual(buildPageItems(20, 20));
    expect(buildPageItems(-3, 20)).toEqual(buildPageItems(1, 20));
  });

  it("should never repeat or skip a page number between the ends", () => {
    for (let current = 1; current <= 30; current++) {
      const numbers = buildPageItems(current, 30).filter((i): i is number => typeof i === "number");
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers).toContain(current);
    }
  });
});
