import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getFlightBoardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/features/flights/lib/get-flight-board", () => ({ getFlightBoard: getFlightBoardMock }));
// A client component that needs the app router; not what these tests are about.
vi.mock("@/features/flights/components/flight-board-filters", () => ({ FlightBoardFilters: () => null }));

import FlightsPage from "@/app/(dashboard)/flights/page";

const EMPTY_BOARD = {
  airports: [{ value: "a1", label: "DXB" }],
  airport: { id: "a1", code: "DXB", name: "Dubai International", timezone: "Asia/Dubai" },
  heading: "DXB · Dubai International · 24 Oct 2026 · Asia/Dubai (GST, UTC+4)",
  rows: [],
  alerts: [],
  source_label: "Simulator",
  last_sync_label: "Never synced",
  truncated: false,
};

const ROW = {
  key: "f1:b1",
  booking_id: "b1",
  booking_number: "BK-1",
  flight_number: "EK 203",
  status: "scheduled",
  scheduled: { date: "24 Oct", time: "16:30 GST" },
  estimated: null,
  change: { kind: "unknown", minutes: null, label: "-" },
  priority: "normal",
  deadline: null,
  deadline_moved: false,
  stale_label: null,
};

const render = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await FlightsPage({ searchParams: Promise.resolve(params) }));

describe("FlightsPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ role: "operations_manager" });
    getFlightBoardMock.mockReset();
    getFlightBoardMock.mockResolvedValue(EMPTY_BOARD);
  });

  it("should guard the page with dashboards:view (defense in depth alongside the layout)", async () => {
    await render();

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should propagate the guard's 403 and not read any flight", async () => {
    requirePermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getFlightBoardMock).not.toHaveBeenCalled();
  });

  it("should pass the status of the address to the board and ignore a bad one", async () => {
    await render({ status: "landed" });
    await render({ status: "bogus" });

    expect(getFlightBoardMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: "landed" }));
    expect(getFlightBoardMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: undefined }));
  });

  it("should show the heading, and the empty state when no flight is in scope", async () => {
    const html = await render();

    expect(html).toContain("Flight board");
    expect(html).toContain("Asia/Dubai (GST, UTC+4)");
    expect(html).toContain("No flights found. Try adjusting the filters.");
  });

  it("should say there is no airport when the viewer sees none", async () => {
    getFlightBoardMock.mockResolvedValue({ ...EMPTY_BOARD, airports: [], airport: null, heading: null });

    expect(await render()).toContain("No airports found");
  });

  it("should list the flights, and say so when the list is cut", async () => {
    getFlightBoardMock.mockResolvedValue({ ...EMPTY_BOARD, rows: [ROW], truncated: true });

    const html = await render();

    expect(html).toContain("EK 203");
    expect(html).toContain("Showing the first 100 flights");
  });

  it("should propagate a failed read so the error state shows and not an empty board", async () => {
    getFlightBoardMock.mockRejectedValue(new Error("boom"));

    await expect(render()).rejects.toThrow("boom");
  });
});
