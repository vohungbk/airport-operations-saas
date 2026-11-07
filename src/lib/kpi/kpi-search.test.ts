import { describe, expect, it } from "vitest";

import { KPI_SEARCH_MAX_LENGTH, filterBySearch, parseKpiSearch } from "@/lib/kpi/kpi-search";

const ITEMS = [
  { label: "Correct-seat fulfilment" },
  { label: "Family Ready on time" },
  { label: "Cleaning / inspection traceability" },
  { label: "Operational incidents" },
  { label: "Commercial performance" },
];

describe("parseKpiSearch (VI-F05-S01, search)", () => {
  it("should trim the words and keep them", () => {
    expect(parseKpiSearch("  seat ")).toBe("seat");
  });

  it("should treat a missing value as no search", () => {
    expect(parseKpiSearch(undefined)).toBe("");
    expect(parseKpiSearch("   ")).toBe("");
  });

  it("should drop a search longer than a name could need", () => {
    expect(parseKpiSearch("a".repeat(KPI_SEARCH_MAX_LENGTH))).toHaveLength(KPI_SEARCH_MAX_LENGTH);
    expect(parseKpiSearch("a".repeat(KPI_SEARCH_MAX_LENGTH + 1))).toBe("");
  });
});

describe("filterBySearch (VI-F05-S01, search)", () => {
  it("should keep every item when there is no search", () => {
    expect(filterBySearch(ITEMS, "")).toHaveLength(5);
  });

  it("should match a part of a name, whatever the case", () => {
    expect(filterBySearch(ITEMS, "SEAT").map((item) => item.label)).toEqual(["Correct-seat fulfilment"]);
    expect(filterBySearch(ITEMS, "incid").map((item) => item.label)).toEqual(["Operational incidents"]);
  });

  it("should need every word, in any order", () => {
    expect(filterBySearch(ITEMS, "time family").map((item) => item.label)).toEqual(["Family Ready on time"]);
    expect(filterBySearch(ITEMS, "family seat")).toEqual([]);
  });

  it("should give nothing when no name matches", () => {
    expect(filterBySearch(ITEMS, "zzz")).toEqual([]);
  });
});
