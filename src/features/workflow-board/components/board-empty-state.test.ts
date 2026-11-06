import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoardEmptyState } from "@/features/workflow-board/components/board-empty-state";

const render = (hasFilters: boolean) => renderToStaticMarkup(createElement(BoardEmptyState, { hasFilters }));

describe("BoardEmptyState (CO-F08-T01, Figma D4 Empty, AC09)", () => {
  it("should say no bookings are shown, with a clipboard of 64 px", () => {
    const html = render(false);

    expect(html).toContain("No bookings to show");
    expect(html).toContain("size-16");
    expect(html).toContain('aria-hidden="true"');
  });

  it("should offer Clear filters, back to the board without filters, only when a filter is set", () => {
    expect(render(true)).toMatch(/<a[^>]*href="\/admin"[^>]*>Clear filters<\/a>/);
    expect(render(false)).not.toContain("Clear filters");
  });

  it("should draw the Clear filters button 240 wide, as the design does", () => {
    expect(render(true)).toContain("w-60");
  });
});
