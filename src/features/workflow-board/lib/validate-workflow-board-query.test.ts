import { describe, expect, it } from "vitest";

import {
  WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR,
  validateWorkflowBoardQuery,
} from "@/features/workflow-board/lib/validate-workflow-board-query";
import { WORKFLOW_BOARD_FILTER_ERRORS } from "@/features/workflow-board/schemas/workflow-board-query.schema";

const PARTNER_ID = "b0000000-0000-0000-0000-000000000001";
const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";

describe("validateWorkflowBoardQuery", () => {
  it("should accept the filters of the bar and leave out a field with no value", () => {
    const result = validateWorkflowBoardQuery({
      partner_id: PARTNER_ID,
      airport_id: AIRPORT_ID,
      date: "2026-10-24",
      q: "",
    });

    expect(result).toEqual({
      ok: true,
      query: { partner_id: PARTNER_ID, airport_id: AIRPORT_ID, date: "2026-10-24" },
    });
  });

  it("should accept no filter at all", () => {
    expect(validateWorkflowBoardQuery({})).toEqual({ ok: true, query: {} });
  });

  it("should give a clear message for a search that is too long", () => {
    expect(validateWorkflowBoardQuery({ q: "x".repeat(51) })).toEqual({
      ok: false,
      error: WORKFLOW_BOARD_FILTER_ERRORS.q,
    });
  });

  it("should give a clear message for a partner that is not an id", () => {
    expect(validateWorkflowBoardQuery({ partner_id: "emirates" })).toEqual({
      ok: false,
      error: WORKFLOW_BOARD_FILTER_ERRORS.partner_id,
    });
  });

  it("should ask for an airport when a date is set without one", () => {
    expect(validateWorkflowBoardQuery({ date: "2026-10-24" })).toEqual({
      ok: false,
      error: WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR,
    });
  });
});
