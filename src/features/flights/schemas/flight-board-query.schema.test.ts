import { describe, expect, it } from "vitest";

import { flightBoardQuerySchema } from "./flight-board-query.schema";

const AIRPORT = "d5400000-0000-4000-8000-000000000001";

describe("flightBoardQuerySchema", () => {
  it("should accept an airport and a status from the address", () => {
    expect(flightBoardQuerySchema.parse({ airport_id: AIRPORT, status: "delayed" })).toEqual({
      airport_id: AIRPORT,
      status: "delayed",
    });
  });

  it("should accept every status of the filter", () => {
    for (const status of ["scheduled", "delayed", "landed", "cancelled", "diverted"]) {
      expect(flightBoardQuerySchema.parse({ status }).status).toBe(status);
    }
  });

  it("should ignore a status that is not one of the five instead of failing the page", () => {
    expect(flightBoardQuerySchema.parse({ status: "bogus" }).status).toBeUndefined();
  });

  it("should ignore an airport that is not an id", () => {
    expect(flightBoardQuerySchema.parse({ airport_id: "DXB'; drop table flights" }).airport_id).toBeUndefined();
  });

  it("should ignore a repeated parameter, which arrives as a list", () => {
    expect(flightBoardQuerySchema.parse({ status: ["landed", "delayed"] }).status).toBeUndefined();
  });

  it("should give no filter when the address has none", () => {
    expect(flightBoardQuerySchema.parse({})).toEqual({ airport_id: undefined, status: undefined });
  });
});
