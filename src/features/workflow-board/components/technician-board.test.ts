import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

// The Move dialog uses the router, which a server render does not have; here it is a marker.
vi.mock("@/features/workflow-board/components/move-booking-dialog", () => ({
  MoveBookingDialog: ({ step }: { step: string }) => createElement("button", { "data-testid": "move" }, `Move to ${step}`),
}));

import { TechnicianBoardColumns } from "@/features/workflow-board/components/technician-board-columns";
import { TechnicianStepCards } from "@/features/workflow-board/components/technician-step-cards";
import { TechnicianStepChips } from "@/features/workflow-board/components/technician-step-chips";
import type { BoardCardItem, BoardColumn } from "@/features/workflow-board/lib/get-workflow-board";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import type { BookingStatus } from "@/features/bookings/types";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

const card = (id: string, status: BookingStatus, overrides: Partial<BoardCardItem> = {}): BoardCardItem => ({
  id,
  booking_number: `BK-${id}`,
  status,
  summary: "EK 203 · DXB",
  seat_status: "reserved",
  partner_name: null,
  flight_number: "EK 203",
  seat_label: "SEAT-0020 · Convertible",
  pickup_label: "15:15 GST · DXB",
  priority: "normal",
  flight_alert: null,
  overdue_label: null,
  time_in_step_label: null,
  ...overrides,
});

const columns = (cards: Partial<Record<BookingStatus, BoardCardItem[]>> = {}): BoardColumn[] =>
  BOOKING_BOARD_STEPS.map((status) => ({
    status,
    label: BOOKING_STATUS_LABEL[status],
    total: cards[status]?.length ?? 0,
    cards: cards[status] ?? [],
  }));

describe("TechnicianBoardColumns (CO-F08-T02 AC03, AC05, AC07)", () => {
  const html = renderToStaticMarkup(
    createElement(TechnicianBoardColumns, {
      columns: columns({
        assigned: [card("a1", "assigned")],
        en_route: [card("e1", "en_route", { partner_name: "Emirates Rent A Car" })],
        installed: [card("i1", "installed")],
        family_ready: [card("f1", "family_ready")],
        in_progress: [card("r1", "in_progress")],
      }),
      query: {},
      role: "technician",
    }),
  );

  it("should make four steps columns and every other step a read-only strip", () => {
    expect(html.match(/data-slot="board-column"/g)).toHaveLength(4);
    expect(html.match(/data-slot="board-strip"/g)).toHaveLength(BOOKING_BOARD_STEPS.length - 4);
  });

  it("should read out the count of a strip for a screen reader", () => {
    expect(html).toContain('aria-label="Active Rental, 1 booking, read only"');
    expect(html).toContain('aria-label="New, 0 bookings, read only"');
  });

  it("should show the cards of a strip nowhere, even when it holds a booking", () => {
    expect(html).not.toContain("BK-r1");
  });

  it("should offer Move only when the step after the booking is a field step", () => {
    const moves = html.match(/Move to [a-z_]+/g);

    expect(moves).toEqual(["Move to en_route", "Move to installed", "Move to family_ready"]);
  });

  it("should show the booking number as text, as a technician has no preview", () => {
    expect(html).toContain("BK-e1");
    expect(html).not.toMatch(/href="[^"]*booking=/);
  });

  it("should show the partner name only when the card has one", () => {
    expect(html).toContain("Emirates Rent A Car");
    expect(html.match(/truncate">Emirates/g)).toHaveLength(1);
  });
});

describe("TechnicianStepChips (CO-F08-T02 AC11)", () => {
  const chips = (selected: BookingStatus) =>
    renderToStaticMarkup(
      createElement(TechnicianStepChips, {
        columns: columns({ en_route: [card("e1", "en_route"), card("e2", "en_route")] }),
        query: { q: "BK" },
        selected,
      }),
    );

  it("should show every step with its count", () => {
    const html = chips("en_route");

    for (const status of BOOKING_BOARD_STEPS) {
      expect(html).toContain(`${BOOKING_STATUS_LABEL[status]} · ${status === "en_route" ? 2 : 0}`);
    }
  });

  it("should link only the active steps, keep the filters in the link and mark the selected one", () => {
    const html = chips("installed");

    expect(html.match(/<a /g)).toHaveLength(4);
    expect(html).toContain('href="/technician/workflow?q=BK&amp;step=en_route"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(BOOKING_BOARD_STEPS.length - 4);
  });

  it("should give every chip a 44 px target", () => {
    const html = chips("en_route");

    expect(html.match(/min-h-11/g)).toHaveLength(BOOKING_BOARD_STEPS.length);
  });
});

describe("TechnicianStepCards", () => {
  const column = (cards: BoardCardItem[], total = cards.length): BoardColumn => ({
    status: "en_route",
    label: "En Route",
    total,
    cards,
  });
  const render = (value: BoardColumn) =>
    renderToStaticMarkup(createElement(TechnicianStepCards, { column: value, query: {}, role: "technician" }));

  it("should show a card for each booking of the step", () => {
    const html = render(column([card("e1", "en_route"), card("e2", "en_route")]));

    expect(html).toContain("BK-e1");
    expect(html).toContain("BK-e2");
  });

  it("should say so when the step has no booking", () => {
    expect(render(column([]))).toContain("No bookings in this step");
  });

  it("should count the bookings beyond the cards shown", () => {
    expect(render(column([card("e1", "en_route")], 4))).toContain("3 more own jobs in this step");
  });
});
