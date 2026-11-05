import { describe, expect, it } from "vitest";

import { buildFlightBoardHref } from "./build-flight-board-href";

const AIRPORT = "d5400000-0000-4000-8000-000000000001";

describe("buildFlightBoardHref", () => {
  it("should give the plain address when no filter is set", () => {
    expect(buildFlightBoardHref({})).toBe("/flights");
  });

  it("should keep the airport and add the status", () => {
    expect(buildFlightBoardHref({ airport_id: AIRPORT }, { status: "landed" })).toBe(`/flights?airport_id=${AIRPORT}&status=landed`);
  });

  it("should drop a filter that is set to undefined", () => {
    expect(buildFlightBoardHref({ airport_id: AIRPORT, status: "landed" }, { status: undefined })).toBe(`/flights?airport_id=${AIRPORT}`);
  });
});
