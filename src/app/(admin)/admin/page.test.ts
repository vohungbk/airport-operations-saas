import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getOptionsMock = vi.hoisted(() => vi.fn());
const getBoardMock = vi.hoisted(() => vi.fn());
const getBookingByIdMock = vi.hoisted(() => vi.fn());
const getBookingEventsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/workflow-board/lib/get-workflow-board-options", () => ({
  getWorkflowBoardOptions: getOptionsMock,
}));

vi.mock("@/features/workflow-board/lib/get-workflow-board", () => ({
  getWorkflowBoard: getBoardMock,
}));

vi.mock("@/features/bookings/lib/get-booking-by-id", () => ({
  getBookingById: getBookingByIdMock,
}));

vi.mock("@/features/bookings/lib/get-booking-events", () => ({
  getBookingEvents: getBookingEventsMock,
}));

// The filter bar and the side panel use the router, which a server render does not have.
vi.mock("@/features/workflow-board/components/workflow-board-filters", () => ({
  WorkflowBoardFilters: ({ total }: { total: number }) =>
    createElement("div", { "data-testid": "filters" }, `${total} in view`),
}));

vi.mock("@/features/workflow-board/components/move-booking-dialog", () => ({
  MoveBookingDialog: () => createElement("button", null, "move"),
}));

vi.mock("@/features/workflow-board/components/preview-sheet", () => ({
  PreviewSheet: ({ children }: { children: ReactNode }) =>
    createElement("aside", { "data-testid": "preview" }, children),
}));

import AdminPage from "@/app/(admin)/admin/page";

const USER = {
  id: "user-1",
  email: "admin@example.com",
  full_name: "Admin User",
  role: "admin" as const,
  partner_id: null,
  is_active: true,
};

const AIRPORT_ID = "a0000000-0000-0000-0000-000000000001";
const BOOKING_ID = "c0000000-0000-0000-0000-000000000001";

const COLUMNS = ["pending", "confirmed", "assigned", "in_progress", "completed"].map((status) => ({
  status,
  label: status.replace("_", " "),
  total: 0,
  cards: [] as unknown[],
}));

function boardWith(card: unknown) {
  const columns = COLUMNS.map((column, index) =>
    index === 0 ? { ...column, label: "Pending", total: 1, cards: [card] } : column,
  );
  return { columns, total: 1 };
}

const CARD = {
  id: BOOKING_ID,
  booking_number: "BK-2026-000123",
  status: "pending",
  summary: "Emirates Rent A Car · EK 203 · DXB",
  seat_status: "available",
  partner_name: "Emirates Rent A Car",
  flight_number: "EK 203",
  seat_label: "SEAT-0001 · Convertible",
  pickup_label: "24 Oct 2026, 15:15 · DXB",
};

const BOOKING = {
  id: BOOKING_ID,
  booking_number: "BK-2026-000123",
  status: "pending",
  partner: { id: "p1", name: "Emirates Rent A Car", code: "EK" },
  airport: { id: AIRPORT_ID, code: "DXB", name: "Dubai", timezone: "Asia/Dubai" },
  flight: { flight_number: "EK 203" },
};

async function render(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(await AdminPage({ searchParams: Promise.resolve(searchParams) }));
}

describe("AdminPage (Workflow Board)", () => {
  beforeEach(() => {
    for (const mock of [requirePermissionMock, getOptionsMock, getBoardMock, getBookingByIdMock, getBookingEventsMock]) {
      mock.mockReset();
    }
    requirePermissionMock.mockResolvedValue(USER);
    getOptionsMock.mockResolvedValue({
      partners: [{ value: "b0000000-0000-0000-0000-000000000001", label: "Emirates Rent A Car" }],
      airports: [{ value: AIRPORT_ID, label: "DXB" }],
    });
    getBoardMock.mockResolvedValue(boardWith(CARD));
    getBookingByIdMock.mockResolvedValue(null);
    getBookingEventsMock.mockResolvedValue({ items: [], truncated: false });
  });

  it("should guard the page with dashboards:view (defense-in-depth alongside the layout)", async () => {
    await render();

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should propagate the guard's redirect instead of swallowing it", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getBoardMock).not.toHaveBeenCalled();
  });

  it("should show each booking in the column of its step", async () => {
    const html = await render();

    expect(html).toContain("Workflow Board");
    expect(html).toContain("5 workflow stages · All airports");
    expect(html).toContain('data-status="pending"');
    expect(html).toContain("BK-2026-000123");
    expect(html).toContain("1 in view");
  });

  it("should ignore a date that has no airport and say that an airport is needed", async () => {
    const html = await render({ date: "2026-10-24" });

    expect(html).toContain("Choose an airport to filter by date.");
    expect(getBoardMock).toHaveBeenCalledWith({});
  });

  it("should read the board with the filters of the address", async () => {
    await render({ airport_id: AIRPORT_ID, date: "2026-10-24" });

    expect(getBoardMock).toHaveBeenCalledWith({ airport_id: AIRPORT_ID, date: "2026-10-24" });
  });

  it("should show the empty state with a way to clear the filters when no booking is in view", async () => {
    getBoardMock.mockResolvedValue({ columns: COLUMNS, total: 0 });

    const html = await render();

    expect(html).toContain("No bookings to show");
    expect(html).toContain('href="/admin"');
    expect(html).not.toContain('data-slot="workflow-board"');
  });

  it("should show a clear message and ignore a filter that is not a valid value", async () => {
    const html = await render({ date: "not-a-date" });

    expect(html).toContain("Enter a valid date.");
    expect(getBoardMock).toHaveBeenCalledWith({});
  });

  it("should ignore an airport that is not one of the listed options", async () => {
    const html = await render({ airport_id: "a0000000-0000-0000-0000-000000000009" });

    expect(html).toContain("Choose an airport from the list.");
    expect(getBoardMock).toHaveBeenCalledWith({});
  });

  it("should show the step of the selected booking in a preview", async () => {
    getBookingByIdMock.mockResolvedValue(BOOKING);

    const html = await render({ booking: BOOKING_ID });

    expect(getBookingByIdMock).toHaveBeenCalledWith(BOOKING_ID);
    expect(html).toContain('data-testid="preview"');
    expect(html).toContain("Current step");
    expect(html).toContain("Pending");
    expect(html).toContain("Step history");
  });

  it("should open no preview for a booking that does not exist or that the database hides", async () => {
    getBookingByIdMock.mockResolvedValue(null);

    const html = await render({ booking: BOOKING_ID });

    expect(html).not.toContain('data-testid="preview"');
  });
});
