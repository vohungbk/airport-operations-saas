import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { WorkflowBoardColumns } from "@/features/workflow-board/components/workflow-board-columns";
import type { BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";

const CARD = {
  id: "booking-1",
  booking_number: "BK-2026-000123",
  partner_name: "Emirates Rent A Car",
  flight_number: "EK 203",
  seat_label: "SEAT-0001 · Convertible",
  pickup_label: "24 Oct 2026, 15:15 · DXB",
};

function column(status: BoardColumn["status"], total: number, cards = [] as BoardColumn["cards"]): BoardColumn {
  return { status, label: status, total, cards };
}

function render(columns: BoardColumn[], query = {}) {
  return renderToStaticMarkup(createElement(WorkflowBoardColumns, { columns, query }));
}

describe("WorkflowBoardColumns", () => {
  it("should show a column per step with its count", () => {
    const html = render([column("pending", 3, [CARD]), column("confirmed", 0)]);

    expect(html).toContain('data-status="pending"');
    expect(html).toContain('data-status="confirmed"');
    expect(html).toContain(">3<");
    expect(html).toContain(">0<");
  });

  it("should show the lines of a card and make it a link that opens the preview", () => {
    const html = render([column("pending", 1, [CARD])], { date: "2026-10-24" });

    expect(html).toContain("BK-2026-000123");
    expect(html).toContain("Emirates Rent A Car");
    expect(html).toContain("EK 203");
    expect(html).toContain("SEAT-0001 · Convertible");
    expect(html).toContain("24 Oct 2026, 15:15 · DXB");
    expect(html).toContain('href="/admin?date=2026-10-24&amp;booking=booking-1"');
  });

  it("should mark the card that is open in the preview", () => {
    const html = render([column("pending", 1, [CARD])], { booking: "booking-1" });

    expect(html).toContain('aria-current="true"');
  });

  it("should say how many bookings are not shown and link to them in the list", () => {
    const html = render([column("pending", 14, [CARD])], { airport_id: "a1", q: "BK" });

    expect(html).toContain("+13 more");
    expect(html).toContain('href="/bookings?status=pending&amp;airport_id=a1&amp;q=BK"');
  });

  it("should show the count without a link when a partner filter is on, as the list has no partner filter", () => {
    const html = render([column("pending", 14, [CARD])], { partner_id: "p1" });

    expect(html).toContain("+13 more");
    expect(html).not.toContain("/bookings?status=pending");
  });

  it("should not show a more link when every booking of the step is shown", () => {
    expect(render([column("pending", 1, [CARD])])).not.toContain("more");
  });

  it("should leave out the lines a booking does not have", () => {
    const html = render([
      column("pending", 1, [{ ...CARD, partner_name: null, flight_number: null, seat_label: null }]),
    ]);

    expect(html).not.toContain("EK 203");
    expect(html).not.toContain("SEAT-0001");
  });
});
