import { describe, expect, it } from "vitest";

import { buildWorkflowBoardHref } from "@/features/workflow-board/lib/build-workflow-board-href";

describe("buildWorkflowBoardHref", () => {
  it("should give the bare board address when there is no filter", () => {
    expect(buildWorkflowBoardHref({})).toBe("/admin");
  });

  it("should keep every filter that has a value and the booking to preview", () => {
    const href = buildWorkflowBoardHref({ date: "2026-10-24", q: "BK-1", booking: "id-1" });

    expect(href).toBe("/admin?date=2026-10-24&q=BK-1&booking=id-1");
  });

  it("should leave out a field that is undefined or empty", () => {
    expect(buildWorkflowBoardHref({ partner_id: undefined, q: "" })).toBe("/admin");
  });

  it("should encode a search that has special characters", () => {
    expect(buildWorkflowBoardHref({ q: "a&b c" })).toBe("/admin?q=a%26b+c");
  });
});
