import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getMetricsMock = vi.hoisted(() => vi.fn());

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

  it("should offer a retry when some figures could not be read", async () => {
    getMetricsMock.mockResolvedValue([
      result("seats_available", null),
      result("incidents_open", 3),
    ]);

    expect(await render()).toContain("RETRY_BUTTON");
  });

  it("should offer a retry when no figure could be read (network failure)", async () => {
    getMetricsMock.mockResolvedValue([
      result("seats_available", null),
      result("incidents_open", null),
    ]);

    expect(await render()).toContain("RETRY_BUTTON");
  });

  it("should not offer a retry when every figure was read, or there is no data yet", async () => {
    expect(await render()).not.toContain("RETRY_BUTTON");

    getMetricsMock.mockResolvedValue([result("seats_available", 0)]);
    expect(await render()).not.toContain("RETRY_BUTTON");
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

  it("should send a partner user to the partner home without reading any figure", async () => {
    requireAnyPermissionMock.mockResolvedValue({
      id: "p-1",
      role: "partner_user",
      partner_id: "partner-a",
    });

    await expect(render()).rejects.toThrow("REDIRECT:/partner");
    expect(getMetricsMock).not.toHaveBeenCalled();
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
      requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role, partner_id: null });

      await expect(render()).resolves.toContain("Dashboard");
      expect(getMetricsMock).toHaveBeenCalledWith(role);
    },
  );

  it("should say some figures are not available yet and keep them out of the counts", async () => {
    getMetricsMock.mockResolvedValue([
      { ...result("seats_available", null), reason: "not_released" },
      result("incidents_open", 3),
    ]);

    const html = await render();

    expect(html).toContain("Some figures are not available yet");
    expect(html).toContain("Not available yet");
    expect(html).toContain(">3<");
    expect(html).not.toContain("Some figures are unavailable");
    expect(html).not.toContain(">0<");
  });

  it("should say there is no data yet when everything that was read is zero, even though a figure is not available yet", async () => {
    getMetricsMock.mockResolvedValue([
      result("incidents_open", 0),
      { ...result("seats_available", null), reason: "not_released" },
    ]);

    const html = await render();

    // Everything read is zero, so the page says so; the figure that is not
    // available yet is not what made it empty.
    expect(html).toContain("No operational data yet");
  });

  it("should show no unavailability note for a dashboard whose modules are all released", async () => {
    const html = await render();

    expect(html).not.toContain("not available yet");
  });

  it("should let an unexpected error reach the error boundary", async () => {
    getMetricsMock.mockRejectedValue(new Error("db down"));

    await expect(render()).rejects.toThrow("db down");
  });
});
