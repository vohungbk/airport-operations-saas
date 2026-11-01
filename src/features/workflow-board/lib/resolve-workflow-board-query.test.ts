import { describe, expect, it } from "vitest";

import { resolveWorkflowBoardQuery } from "@/features/workflow-board/lib/resolve-workflow-board-query";
import { WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR } from "@/features/workflow-board/lib/validate-workflow-board-query";
import { WORKFLOW_BOARD_FILTER_ERRORS } from "@/features/workflow-board/schemas/workflow-board-query.schema";

const PARTNER_ID = "b0000000-0000-0000-0000-000000000001";
const OTHER_PARTNER_ID = "b0000000-0000-0000-0000-000000000002";
const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";

const options = {
  partners: [{ value: PARTNER_ID, label: "Emirates Rent A Car" }],
  airports: [{ value: AIRPORT_ID, label: "DXB" }],
};

describe("resolveWorkflowBoardQuery", () => {
  it("should keep a partner and an airport that are among the listed options", () => {
    const result = resolveWorkflowBoardQuery({ partner_id: PARTNER_ID, airport_id: AIRPORT_ID }, options);

    expect(result).toEqual({ query: { partner_id: PARTNER_ID, airport_id: AIRPORT_ID }, errors: [] });
  });

  it("should drop a well formed partner id that is not listed and say so", () => {
    const result = resolveWorkflowBoardQuery({ partner_id: OTHER_PARTNER_ID }, options);

    expect(result.query).toEqual({});
    expect(result.errors).toEqual([WORKFLOW_BOARD_FILTER_ERRORS.partner_id]);
  });

  it("should drop an airport that is not listed and keep the other filters", () => {
    const result = resolveWorkflowBoardQuery(
      { airport_id: "a0000000-0000-0000-0000-000000000009", partner_id: PARTNER_ID },
      options,
    );

    expect(result.query).toEqual({ partner_id: PARTNER_ID });
    expect(result.errors).toEqual([WORKFLOW_BOARD_FILTER_ERRORS.airport_id]);
  });

  it("should drop a day that has no airport and say that an airport is needed", () => {
    const result = resolveWorkflowBoardQuery({ date: "2026-10-24" }, options);

    expect(result.query).toEqual({});
    expect(result.errors).toEqual([WORKFLOW_BOARD_DATE_NEEDS_AIRPORT_ERROR]);
  });

  it("should keep a day that has an airport", () => {
    const result = resolveWorkflowBoardQuery({ airport_id: AIRPORT_ID, date: "2026-10-24" }, options);

    expect(result).toEqual({ query: { airport_id: AIRPORT_ID, date: "2026-10-24" }, errors: [] });
  });

  it("should give no error and no filter for an empty address", () => {
    expect(resolveWorkflowBoardQuery({}, options)).toEqual({ query: {}, errors: [] });
  });
});
