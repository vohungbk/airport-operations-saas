import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { WorkflowBoardFilters } from "@/features/workflow-board/components/workflow-board-filters";
import type { WorkflowBoardQuery } from "@/features/workflow-board/schemas/workflow-board-query.schema";

const PARTNERS = [{ value: "p1", label: "Emirates Rent A Car" }];
const AIRPORTS = [{ value: "a1", label: "DXB" }];

const render = (props: { bar?: boolean; query?: WorkflowBoardQuery; total?: number | null } = {}) =>
  renderToStaticMarkup(
    createElement(WorkflowBoardFilters, {
      query: props.query ?? {},
      partners: PARTNERS,
      airports: AIRPORTS,
      total: props.total === undefined ? 34 : props.total,
      bar: props.bar,
    }),
  );

describe("WorkflowBoardFilters bar (CO-F08-T01, Figma D4)", () => {
  it("should show the filters of the design in a bar, with its own labels", () => {
    const html = render({ bar: true });

    expect(html).toContain('data-slot="board-filter-bar"');
    expect(html).toContain("All partners");
    expect(html).toContain("All airports");
    expect(html).toContain("Booking number");
    expect(html).toContain("All alerts");
    expect(html).toContain("All priority");
    expect(html).toContain("Clear filters");
  });

  it("should keep the labels of the technician board when it is not the bar", () => {
    const html = render();

    expect(html).not.toContain('data-slot="board-filter-bar"');
    expect(html).toContain("Flight alert: All");
    expect(html).toContain("Priority: All");
    expect(html).toContain("Booking search");
  });

  it("should show the count of bookings in view, and a dash when the board could not be read", () => {
    expect(render({ bar: true })).toContain("34 bookings in view");
    expect(render({ bar: true, total: null })).toContain("— bookings in view");
  });

  it("should draw Clear filters quiet while no filter is set and as a normal button when one is", () => {
    expect(render({ bar: true })).toContain('data-idle="true"');
    expect(render({ bar: true, query: { priority: "high" } })).not.toContain("data-idle");
    expect(render()).not.toContain("data-idle");
  });

  it("should show the filters that are on as chips that can be removed", () => {
    const html = render({ bar: true, query: { priority: "high" } });

    expect(html).toContain("Remove filter");
  });
});
