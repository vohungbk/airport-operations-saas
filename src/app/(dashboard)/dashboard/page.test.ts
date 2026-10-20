import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getMetricsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requireAnyPermission: requireAnyPermissionMock,
}));

vi.mock("@/features/dashboard/lib/get-dashboard-metrics", () => ({
  getDashboardMetrics: getMetricsMock,
}));

import DashboardPage from "@/app/(dashboard)/dashboard/page";
import {
  DASHBOARD_METRICS,
  type DashboardMetric,
} from "@/features/dashboard/lib/dashboard-metrics";

const metric = (id: string): DashboardMetric =>
  DASHBOARD_METRICS.find((m) => m.id === id)!;

const result = (id: string, value: number | null) => ({
  metric: metric(id),
  value,
});

async function render() {
  return renderToStaticMarkup(await DashboardPage());
}

describe("DashboardPage", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    getMetricsMock.mockReset();
    getMetricsMock.mockResolvedValue([
      result("seats_available", 12),
      result("incidents_open", 3),
    ]);
  });

  it("should guard the page with the dashboard access permissions", async () => {
    await render();

    expect(requireAnyPermissionMock).toHaveBeenCalledWith([
      "dashboards:view",
      "jobs:view_assigned",
      "operations:view_own_partner",
    ]);
  });

  it("should propagate the guard's redirect without reading any figure", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getMetricsMock).not.toHaveBeenCalled();
  });

  it("should read the figures for the role of the user", async () => {
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });

    await render();

    expect(getMetricsMock).toHaveBeenCalledWith("technician");
  });

  it("should show each figure with its label and a link to the list it counts", async () => {
    const html = await render();

    expect(html).toContain("Available seats");
    expect(html).toContain(">12<");
    expect(html).toContain('href="/seats?status=available"');
    expect(html).toContain("Open incidents");
    expect(html).toContain(">3<");
    expect(html).toContain('href="/incidents?status=open"');
    expect(html).not.toContain("Unavailable");
  });

  it("should say there is no data yet when every figure was read and is zero", async () => {
    getMetricsMock.mockResolvedValue([
      result("seats_available", 0),
      result("incidents_open", 0),
    ]);

    const html = await render();

    expect(html).toContain("No operational data yet");
    expect(html).not.toContain("Available seats");
  });

  it("should keep a real zero as a figure when other figures are above zero", async () => {
    getMetricsMock.mockResolvedValue([
      result("seats_available", 0),
      result("incidents_open", 3),
    ]);

    const html = await render();

    expect(html).toContain("Available seats");
    expect(html).toContain(">0<");
    expect(html).not.toContain("No operational data yet");
  });

  it("should mark a figure that could not be read as unavailable, not as zero, and add a note", async () => {
    getMetricsMock.mockResolvedValue([
      result("seats_available", null),
      result("incidents_open", 3),
    ]);

    const html = await render();

    expect(html).toContain("Some figures are unavailable");
    expect(html).toContain("Unavailable");
    expect(html).not.toContain(">0<");
    expect(html).toContain(">3<");
  });

  it("should say so when no figure could be read", async () => {
    getMetricsMock.mockResolvedValue([
      result("seats_available", null),
      result("incidents_open", null),
    ]);

    const html = await render();

    expect(html).toContain("None of the figures could be read");
    expect(html).not.toContain("No operational data yet");
  });

  it("should let an unexpected error reach the error boundary", async () => {
    getMetricsMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
