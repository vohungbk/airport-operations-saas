import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

// The Move dialog uses the router, which a server render does not have; here it is a marker.
vi.mock("@/features/workflow-board/components/move-booking-dialog", () => ({
  MoveBookingDialog: ({ step }: { step: string }) => createElement("button", { "data-testid": "move" }, `Move to ${step}`),
}));

import { WorkflowBoardColumns } from "@/features/workflow-board/components/workflow-board-columns";
import type { BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";
import type { Role } from "@/lib/auth/roles";

const CARD = {
  id: "booking-1",
  booking_number: "BK-2026-000123",
  status: "pending" as const,
  summary: "Emirates Rent A Car · EK 203 · DXB",
  seat_status: "available" as const,
  partner_name: "Emirates Rent A Car",
  flight_number: "EK 203",
  seat_label: "SEAT-0001 · Convertible",
  pickup_label: "15:15 GST · DXB",
  priority: "normal" as const,
  flight_alert: null,
  overdue_label: null,
  time_in_step_label: null,
};

function column(status: BoardColumn["status"], total: number, cards = [] as BoardColumn["cards"]): BoardColumn {
  return { status, label: status, total, cards };
}

function render(columns: BoardColumn[], query = {}, role: Role = "admin") {
  return renderToStaticMarkup(createElement(WorkflowBoardColumns, { columns, query, role }));
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
    expect(html).toContain("15:15 GST · DXB");
    expect(html).toContain('href="/admin?date=2026-10-24&amp;booking=booking-1"');
  });

  it("should show the priority of a card by icon and text", () => {
    const html = render([column("pending", 1, [{ ...CARD, priority: "high" }])]);

    expect(html).toContain('data-priority="high"');
    expect(html).toContain("High");
  });

  it("should show the flight alert and the overdue time of a card, and not on a card that is on time", () => {
    const late = render([
      column("pending", 1, [
        {
          ...CARD,
          flight_alert: { kind: "early" as const, minutes: 45, label: "Early 45 min" },
          overdue_label: "Overdue by 20 min",
          time_in_step_label: "In step 2 h 10 min",
        },
      ]),
    ]);

    expect(late).toContain("Early 45 min");
    expect(late).toContain("Overdue by 20 min");
    expect(late).toContain("In step 2 h 10 min");

    const onTime = render([column("pending", 1, [CARD])]);
    expect(onTime).not.toContain("Overdue");
    expect(onTime).not.toContain("Early");
    expect(onTime).not.toContain("In step");
  });

  it("should say so in a column with no booking", () => {
    const html = render([column("pending", 1, [CARD]), column("confirmed", 0)]);

    expect(html.match(/No bookings in this step/g)).toHaveLength(1);
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
    expect(render([column("pending", 1, [CARD])])).not.toMatch(/\+\d+ more/);
  });

  it("should offer the move to the next step to a role that may move to it", () => {
    const html = render([column("pending", 1, [CARD])], {}, "operations_manager");

    expect(html).toContain('data-testid="move"');
    expect(html).toContain("Move to confirmed");
  });

  it("should not offer a move to a role that may not move to the next step", () => {
    expect(render([column("pending", 1, [CARD])], {}, "partner_user")).not.toContain('data-testid="move"');
    expect(render([column("pending", 1, [CARD])], {}, "technician")).not.toContain('data-testid="move"');
  });

  it("should not offer a move from the last step", () => {
    const html = render([column("completed", 1, [{ ...CARD, status: "completed" }])]);

    expect(html).not.toContain('data-testid="move"');
  });

  it("should leave out the lines a booking does not have", () => {
    const html = render([
      column("pending", 1, [{ ...CARD, partner_name: null, flight_number: null, seat_label: null }]),
    ]);

    expect(html).not.toContain("EK 203");
    expect(html).not.toContain("SEAT-0001");
  });

  it("should draw the column as the design does: 280 wide, the step, the count and the scroll hint", () => {
    const html = render([column("pending", 3, [CARD])]);

    expect(html).toContain("w-70");
    expect(html).toContain('data-slot="board-column-count"');
    expect(html).toContain("Scroll for more");
    expect(html).toContain('data-slot="board-scroll-fade"');
  });

  it("should show the flight of a card as a chip and the seat, pickup and priority lines", () => {
    const html = render([column("pending", 1, [CARD])]);

    expect(html).toContain('data-slot="board-flight-chip"');
    expect(html).toContain("Normal");
  });

  it("should keep the Move button and say why under it when the seat is not ready", () => {
    // Moving to Technician Assigned needs the seat to be Available; this one is in use.
    const html = render([
      column("ready", 1, [{ ...CARD, status: "ready" as const, seat_status: "in_use" as const }]),
    ]);

    expect(html).toContain('data-testid="move"');
    expect(html).toContain('data-slot="board-move-note"');
    expect(html).toContain("Seat must be Available");
  });

  it("should say nothing under the Move button when the seat is ready or the step needs no seat", () => {
    const needsSeat = render([column("ready", 1, [{ ...CARD, status: "ready" as const, seat_status: "available" as const }])]);
    const noSeatRule = render([column("pending", 1, [CARD])]);

    expect(needsSeat).not.toContain("board-move-note");
    expect(noSeatRule).not.toContain("board-move-note");
  });

  it("should not say anything about the seat to a role that may not move the booking", () => {
    const html = render(
      [column("ready", 1, [{ ...CARD, status: "ready" as const, seat_status: "in_use" as const }])],
      {},
      "partner_user",
    );

    expect(html).not.toContain("Seat must be");
  });
});
