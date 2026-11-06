import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkflowBoardLoading } from "@/features/workflow-board/components/workflow-board-loading";

const html = () => renderToStaticMarkup(createElement(WorkflowBoardLoading));

describe("WorkflowBoardLoading (CO-F08-T01, Figma D4 Loading)", () => {
  it("should say Loading once for assistive technology and keep the title and the stages", () => {
    const out = html();

    expect(out).toContain('role="status"');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('aria-label="Loading"');
    expect(out).toContain("Workflow Board");
    expect(out).toContain("13 workflow stages");
  });

  it("should draw the filters of the bar with a dash for the count, hidden from assistive technology", () => {
    const out = html();

    expect(out).toContain('data-slot="board-loading-filters"');
    for (const label of ["All partners", "All airports", "Booking number", "All alerts", "All priority", "Clear filters"]) {
      expect(out).toContain(label);
    }
    expect(out).toContain("— bookings");
    expect(out).not.toContain("<input");
  });

  it("should draw four skeleton columns of two cards with six lines each, 280 wide", () => {
    const out = html();

    expect(out.match(/data-slot="board-skeleton-column"/g)).toHaveLength(4);
    expect(out.match(/h-\[270px\]/g)).toHaveLength(8);
    expect(out.match(/data-slot="skeleton"/g)).toHaveLength(48);
    expect(out).toContain("w-70");
  });

  it("should not show a booking or a Move button while loading", () => {
    const out = html();

    expect(out).not.toContain("BK-");
    expect(out).not.toContain("Move to");
  });
});
