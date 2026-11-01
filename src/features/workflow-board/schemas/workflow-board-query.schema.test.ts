import { describe, expect, it } from "vitest";

import {
  WORKFLOW_BOARD_FILTER_ERRORS,
  parseWorkflowBoardQuery,
  workflowBoardQuerySchema,
} from "@/features/workflow-board/schemas/workflow-board-query.schema";

const PARTNER_ID = "b0000000-0000-0000-0000-000000000001";
const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";

describe("workflowBoardQuerySchema", () => {
  it("should accept an empty filter, which is the default board", () => {
    expect(workflowBoardQuerySchema.safeParse({}).success).toBe(true);
  });

  it("should accept a partner, an airport, a day and a search", () => {
    const result = workflowBoardQuerySchema.safeParse({
      partner_id: PARTNER_ID,
      airport_id: AIRPORT_ID,
      date: "2026-10-24",
      q: "BK-2026",
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ["a partner that is not an id", { partner_id: "emirates" }],
    ["an airport that is not an id", { airport_id: "DXB" }],
    ["a date that does not exist", { date: "2026-02-31" }],
    ["a date in the wrong format", { date: "24/10/2026" }],
    ["a search longer than the limit", { q: "x".repeat(51) }],
  ])("should reject %s", (_name, input) => {
    expect(workflowBoardQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe("parseWorkflowBoardQuery", () => {
  it("should keep the valid fields and no error for a clean address", () => {
    const result = parseWorkflowBoardQuery({ partner_id: PARTNER_ID, date: "2026-10-24" });

    expect(result).toEqual({ query: { partner_id: PARTNER_ID, date: "2026-10-24" }, errors: [] });
  });

  it("should report a clear message and drop a value that is not one of the allowed shapes", () => {
    const result = parseWorkflowBoardQuery({ partner_id: "emirates", airport_id: AIRPORT_ID });

    expect(result.query).toEqual({ airport_id: AIRPORT_ID });
    expect(result.errors).toEqual([WORKFLOW_BOARD_FILTER_ERRORS.partner_id]);
  });

  it("should treat a missing or empty value as no filter, without an error", () => {
    const result = parseWorkflowBoardQuery({ partner_id: "", q: "   ", date: undefined });

    expect(result).toEqual({ query: {}, errors: [] });
  });

  it("should read the first value when a field is repeated in the address", () => {
    const result = parseWorkflowBoardQuery({ airport_id: [AIRPORT_ID, "other"] });

    expect(result.query).toEqual({ airport_id: AIRPORT_ID });
  });
});
