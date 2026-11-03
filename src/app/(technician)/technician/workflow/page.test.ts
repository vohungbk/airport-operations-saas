import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getOptionsMock = vi.hoisted(() => vi.fn());
const getBoardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/workflow-board/lib/get-workflow-board-options", () => ({
  getWorkflowBoardOptions: getOptionsMock,
}));

vi.mock("@/features/workflow-board/lib/get-workflow-board", () => ({
  getWorkflowBoard: getBoardMock,
}));

// The filters and the Move dialog use the router, which a server render does not have.
vi.mock("@/features/workflow-board/components/workflow-board-filters", () => ({
  WorkflowBoardFilters: ({ total, hidePartner }: { total: number | null; hidePartner?: boolean }) =>
    createElement("div", { "data-testid": "filters", "data-hide-partner": String(hidePartner) }, `${total ?? "—"} in view`),
}));

vi.mock("@/features/workflow-board/components/technician-filter-sheet", () => ({
  TechnicianFilterSheet: ({ filterCount }: { filterCount: number }) =>
    createElement("button", { "data-testid": "filter-button" }, `Filters ${filterCount}`),
}));

vi.mock("@/features/workflow-board/components/board-load-error", () => ({
  BoardLoadError: () => createElement("div", { role: "alert" }, "The board could not be loaded. Retry"),
}));

vi.mock("@/features/workflow-board/components/move-booking-dialog", () => ({
  MoveBookingDialog: ({ step }: { step: string }) => createElement("button", { "data-testid": "move" }, `Move to ${step}`),
}));

import TechnicianWorkflowPage from "@/app/(technician)/technician/workflow/page";
import { BOOKING_STATUS_LABEL } from "@/features/bookings/lib/booking-status";
import { BOOKING_BOARD_STEPS } from "@/lib/workflow/board";

const USER = {
  id: "user-1",
  email: "tech@example.com",
  full_name: "Omar Haddad",
  role: "technician" as const,
  partner_id: null,
  is_active: true,
};

const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";

const CARD = {
  id: "booking-1",
  booking_number: "BK-2026-000142",
  status: "en_route",
  summary: "EK 203 · DXB",
  seat_status: "reserved",
  partner_name: null,
  flight_number: "EK 203",
  seat_label: "SEAT-0020 · Convertible",
  pickup_label: "15:15 GST · DXB",
  priority: "high",
  flight_alert: { kind: "early", minutes: 45, label: "Early 45 min" },
  overdue_label: "Overdue by 20 min",
  time_in_step_label: "In step 2 h 10 min",
};

const board = (cardsByStep: Record<string, unknown[]> = {}) => {
  const columns = BOOKING_BOARD_STEPS.map((status) => ({
    status,
    label: BOOKING_STATUS_LABEL[status],
    total: cardsByStep[status]?.length ?? 0,
    cards: cardsByStep[status] ?? [],
  }));
  return { columns, total: columns.reduce((sum, column) => sum + column.total, 0), time_zone: null };
};

async function render(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(await TechnicianWorkflowPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("TechnicianWorkflowPage (CO-F08-T02)", () => {
  beforeEach(() => {
    for (const mock of [requirePermissionMock, getOptionsMock, getBoardMock]) mock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);
    getOptionsMock.mockResolvedValue({ partners: [], airports: [{ value: AIRPORT_ID, label: "DXB" }] });
    getBoardMock.mockResolvedValue(board({ en_route: [CARD] }));
  });

  it("should guard the page with jobs:view_assigned (defense-in-depth alongside the layout)", async () => {
    await render();

    expect(requirePermissionMock).toHaveBeenCalledWith("jobs:view_assigned");
  });

  it("should propagate the guard's redirect and read nothing for a role that may not open the board", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getBoardMock).not.toHaveBeenCalled();
  });

  it("should show the bookings of the technician by step, with the count of each (AC01)", async () => {
    const html = await render();

    expect(html).toContain("BK-2026-000142");
    expect(html).toContain("En Route · 1");
    expect(html).toContain("1 own booking");
    expect(html).toContain("13 workflow stages");
  });

  it("should show the fields of the card and no partner field it does not have (AC07)", async () => {
    const html = await render();

    expect(html).toContain("EK 203");
    expect(html).toContain("SEAT-0020 · Convertible");
    expect(html).toContain("15:15 GST · DXB");
    expect(html).toContain("Early 45 min");
    expect(html).not.toContain("Emirates");
  });

  it("should leave the partner filter out of the filters (AC02)", async () => {
    const html = await render();

    expect(html).toContain('data-hide-partner="true"');
  });

  it("should ignore a partner or a booking in the address when it reads the board (AC09)", async () => {
    await render({ partner_id: "b0000000-0000-0000-0000-000000000002", booking: "c0000000-0000-0000-0000-000000000001" });

    const query = getBoardMock.mock.calls[0]![0];
    expect(query.partner_id).toBeUndefined();
    expect(query.booking).toBeUndefined();
  });

  it("should open the step of the address on a phone, and not a read-only one", async () => {
    getBoardMock.mockResolvedValue(
      board({ installed: [{ ...CARD, id: "b2", booking_number: "BK-INSTALLED", status: "installed" }], en_route: [CARD] }),
    );

    const installed = await render({ step: "installed" });
    const readOnly = await render({ step: "in_progress" });

    expect(installed).toContain('aria-label="Installed"');
    expect(readOnly).toContain('aria-label="En Route"');
  });

  it("should say that no job is assigned, and reveal nothing else, when the technician has no booking (AC08)", async () => {
    getBoardMock.mockResolvedValue(board());

    const html = await render();

    expect(html).toContain("No jobs are assigned to you");
    expect(html).not.toContain("Clear filters");
    expect(html).not.toContain('data-slot="technician-board"');
  });

  it("should offer Clear filters in the empty state when a filter is on", async () => {
    getBoardMock.mockResolvedValue(board());

    const html = await render({ airport_id: AIRPORT_ID });

    expect(html).toContain("No bookings to show");
    expect(html).toContain("Clear filters");
  });

  it("should keep the title and the filters and show a retry when the board cannot be read (AC10)", async () => {
    getBoardMock.mockRejectedValue({ code: "XX000" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = await render();

    expect(html).toContain("Workflow Board");
    expect(html).toContain('data-testid="filters"');
    expect(html).toContain("The board could not be loaded.");
    expect(html).toContain("Retry");
    expect(html).not.toContain("XX000");
    errorSpy.mockRestore();
  });

  it("should show the Move button only for a step the technician may move to (AC04, AC05)", async () => {
    getBoardMock.mockResolvedValue(
      board({
        assigned: [{ ...CARD, id: "a", status: "assigned" }],
        family_ready: [{ ...CARD, id: "f", status: "family_ready" }],
      }),
    );

    const html = await render();

    expect(html).toContain("Move to en_route");
    expect(html).not.toContain("Move to in_progress");
  });
});
