import { describe, expect, it } from "vitest";

import { flightIdSchema, parseFlightUpdateRow } from "./flight-update.schema";

const ROW = {
  id: "u-1",
  source: "provider",
  occurred_at: "2026-10-24T10:02:00.000Z",
  changes: [{ field: "estimated_arrival_at", from: "2026-10-24T12:30:00Z", to: "2026-10-24T11:45:00Z" }],
};

describe("parseFlightUpdateRow (VI-F02-T01)", () => {
  it("should return the entry with its source, time and changes", () => {
    expect(parseFlightUpdateRow(ROW)).toEqual(ROW);
  });

  it("should accept the three sources of the history", () => {
    for (const source of ["provider", "system", "manual"]) {
      expect(parseFlightUpdateRow({ ...ROW, source })?.source).toBe(source);
    }
  });

  it("should leave out an entry from a source that is not known", () => {
    expect(parseFlightUpdateRow({ ...ROW, source: "guess" })).toBeNull();
  });

  it("should leave out an entry whose time is not a date", () => {
    expect(parseFlightUpdateRow({ ...ROW, occurred_at: "yesterday" })).toBeNull();
  });

  it("should keep the changes that are valid and drop the ones that are not", () => {
    const row = {
      ...ROW,
      changes: [{ field: "terminal", from: "1", to: "3" }, { field: "colour", from: "a", to: "b" }, "junk", null],
    };

    expect(parseFlightUpdateRow(row)?.changes).toEqual([{ field: "terminal", from: "1", to: "3" }]);
  });

  it("should leave out an entry that has no valid change", () => {
    expect(parseFlightUpdateRow({ ...ROW, changes: [{ field: "colour" }] })).toBeNull();
    expect(parseFlightUpdateRow({ ...ROW, changes: [] })).toBeNull();
  });

  it("should leave out a row whose changes are not a list", () => {
    expect(parseFlightUpdateRow({ ...ROW, changes: { field: "terminal" } })).toBeNull();
  });

  it("should leave out something that is not a row", () => {
    expect(parseFlightUpdateRow(null)).toBeNull();
    expect(parseFlightUpdateRow("row")).toBeNull();
  });
});

describe("flightIdSchema", () => {
  it("should accept an id as the database writes it and refuse text that is not an id", () => {
    expect(flightIdSchema.safeParse("d5300000-0000-0000-0000-000000000001").success).toBe(true);
    expect(flightIdSchema.safeParse("1 or 1=1").success).toBe(false);
  });
});
