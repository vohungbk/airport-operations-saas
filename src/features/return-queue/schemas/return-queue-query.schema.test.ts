import { describe, expect, it } from "vitest";

import { buildReturnQueueHref } from "@/features/return-queue/lib/build-return-queue-href";
import { parseReturnQueueQuery } from "@/features/return-queue/schemas/return-queue-query.schema";

const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";

describe("parseReturnQueueQuery", () => {
  it("should read a valid search, step, airport and page", () => {
    expect(
      parseReturnQueueQuery({
        q: " SEAT-0001 ",
        step: "cleaning",
        airport_id: AIRPORT_ID,
        page: "2",
      }),
    ).toEqual({
      q: "SEAT-0001",
      step: "cleaning",
      airport_id: AIRPORT_ID,
      page: 2,
      page_size: 20,
    });
  });

  it("should fall back to the defaults when the values are garbled", () => {
    expect(
      parseReturnQueueQuery({
        q: "x".repeat(101),
        step: "washing",
        airport_id: "DXB",
        page: "-1",
        page_size: "1000",
      }),
    ).toEqual({ page: 1, page_size: 20 });
  });

  it("should write the query back into the address with the overrides", () => {
    const query = parseReturnQueueQuery({ q: "SEAT", step: "cleaning", page: "3" });

    expect(buildReturnQueueHref(query, { step: undefined, page: 1 })).toBe(
      "/return-queue?q=SEAT&page=1&page_size=20",
    );
  });
});
