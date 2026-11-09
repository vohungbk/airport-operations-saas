import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getChartsMock = vi.hoisted(() => vi.fn());
const getFlightAlertsMock = vi.hoisted(() => vi.fn());
const getStockMock = vi.hoisted(() => vi.fn());
const getTodayFiguresMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/kpi/get-kpi-figures", () => ({
  getTodayFigures: getTodayFiguresMock,
}));

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/features/dashboard/components/dashboard-retry-button", () => ({
  DashboardRetryButton: () => "RETRY_BUTTON",
}));

vi.mock("@/features/dashboard/components/dashboard-refresh-button", () => ({
  DashboardRefreshButton: () => "REFRESH_BUTTON",
}));

vi.mock("@/features/dashboard/lib/get-dashboard-charts", () => ({
  getDashboardCharts: getChartsMock,
}));

vi.mock("@/features/dashboard/lib/get-flight-alerts", () => ({
  getFlightAlerts: getFlightAlertsMock,
}));

vi.mock("@/features/dashboard/lib/get-stock-by-category", () => ({
  getStockByCategory: getStockMock,
}));

import DashboardPage from "@/app/(dashboard)/dashboard/page";

async function render() {
  return renderToStaticMarkup(await DashboardPage());
}

describe("DashboardPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getChartsMock.mockReset();
    getChartsMock.mockResolvedValue([]);
    getFlightAlertsMock.mockReset();
    getFlightAlertsMock.mockResolvedValue([]);
    getStockMock.mockReset();
    getStockMock.mockResolvedValue([]);
    getTodayFiguresMock.mockReset();
    getTodayFiguresMock.mockResolvedValue({ arrivals_today: null, installations_due: null });
  });

  it("should show the Arrivals today and Installations due numbers (VI-F05-T02, AC01, AC02)", async () => {
    getTodayFiguresMock.mockResolvedValue({ arrivals_today: 12, installations_due: 5 });

    const html = await render();

    expect(html).toMatch(/Arrivals today<\/p><p[^>]*>12</);
    expect(html).toMatch(/Installations due<\/p><p[^>]*>5</);
  });

  it("should guard the page with the dashboard access permissions", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "dashboards:view",
      "jobs:view_assigned",
      "operations:view_own_partner",
    ]);
  });

  it("should propagate the guard's redirect without reading anything", async () => {
    requireAnyPermissionMock.mockRejectedValue(
      new Error("REDIRECT:/forbidden"),
    );

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getChartsMock).not.toHaveBeenCalled();
    expect(getFlightAlertsMock).not.toHaveBeenCalled();
    expect(getStockMock).not.toHaveBeenCalled();
  });

  it("should read the charts for the role of the user", async () => {
    requireAnyPermissionMock.mockResolvedValue({
      id: "t-1",
      role: "technician",
    });

    await render();

    expect(getChartsMock).toHaveBeenCalledWith("technician");
  });

  it("should show the Command Centre of the design", async () => {
    const html = await render();

    expect(html).toContain("Command Centre");
    expect(html).toContain("Live operations");
    expect(html).toContain("Arrivals today");
    expect(html).toContain("Operational attention");
  });

  it("should show the refresh button and the load time of the figures (VI-F11-S01, AC02)", async () => {
    const html = await render();

    expect(html).toContain("REFRESH_BUTTON");
    expect(html).toMatch(/Loaded \d{2}:\d{2} UTC/);
  });

  it("should show nothing that is not in the design", async () => {
    const html = await render();

    expect(html).not.toContain("All counts");
    expect(html).not.toContain("Export report");
  });

  it("should send a partner user to the partner home without reading anything", async () => {
    requireAnyPermissionMock.mockResolvedValue({
      id: "p-1",
      role: "partner_user",
      partner_id: "partner-a",
    });

    await expect(render()).rejects.toThrow("REDIRECT:/partner");
    expect(getChartsMock).not.toHaveBeenCalled();
  });

  it("should send a partner user with no partner to the partner home too, which says so", async () => {
    requireAnyPermissionMock.mockResolvedValue({
      id: "p-1",
      role: "partner_user",
      partner_id: null,
    });

    await expect(render()).rejects.toThrow("REDIRECT:/partner");
  });

  it.each(["admin", "operations_manager", "technician"] as const)(
    "should keep the %s role on the dashboard",
    async (role) => {
      requireAnyPermissionMock.mockResolvedValue({
        id: "u-1",
        role,
        partner_id: null,
      });

      await expect(render()).resolves.toContain("Command Centre");
      expect(getChartsMock).toHaveBeenCalledWith(role);
    },
  );

  it("should let an unexpected error reach the error boundary", async () => {
    getChartsMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
