import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const getMetricsMock = vi.hoisted(() => vi.fn());
const getSummaryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/features/dashboard/lib/get-dashboard-metrics", () => ({
  getDashboardMetrics: getMetricsMock,
}));

vi.mock("@/features/partners/lib/get-partner-summary", () => ({
  getPartnerSummary: getSummaryMock,
}));

vi.mock("@/features/dashboard/components/dashboard-retry-button", () => ({
  DashboardRetryButton: () => "RETRY_BUTTON",
}));

import PartnerPage from "@/app/(partner)/partner/page";
import { DASHBOARD_METRICS } from "@/features/dashboard/lib/dashboard-metrics";

const result = (id: string, value: number | null) => ({
  metric: DASHBOARD_METRICS.find((m) => m.id === id)!,
  value,
});

const USER = {
  id: "user-1",
  email: "partner@example.com",
  full_name: "Partner User",
  role: "partner_user" as const,
  partner_id: "partner-a",
  is_active: true,
};

async function render() {
  return renderToStaticMarkup(await PartnerPage());
}

describe("PartnerPage", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue(USER);
    getMetricsMock.mockReset();
    getMetricsMock.mockResolvedValue([
      result("bookings_pending", 4),
      result("bookings_in_progress", 2),
    ]);
    getSummaryMock.mockReset();
    getSummaryMock.mockResolvedValue({ name: "ERAC Rentals", code: "ERAC" });
  });

  it("should guard the page with bookings:view_own_partner (defense-in-depth alongside the layout)", async () => {
    await render();

    expect(requirePermissionMock).toHaveBeenCalledWith("bookings:view_own_partner");
  });

  it("should propagate the guard's redirect without reading anything", async () => {
    requirePermissionMock.mockRejectedValue(new Error("REDIRECT:/forbidden"));

    await expect(render()).rejects.toThrow("REDIRECT:/forbidden");
    expect(getSummaryMock).not.toHaveBeenCalled();
    expect(getMetricsMock).not.toHaveBeenCalled();
  });

  it("should show the partner's name, code and figures, and never its raw id", async () => {
    const html = await render();

    expect(html).toContain("ERAC Rentals");
    expect(html).toContain("ERAC");
    expect(html).toContain("Pending bookings");
    expect(html).toContain(">4<");
    expect(html).not.toContain("partner-a");
  });

  it("should read the partner of the signed-in user only, and the figures for the user's role", async () => {
    await render();

    expect(getSummaryMock).toHaveBeenCalledWith("partner-a");
    expect(getMetricsMock).toHaveBeenCalledWith("partner_user");
  });

  it("should lead to the bookings list and mark seats as not available yet, with no dead link", async () => {
    const html = await render();

    expect(html).toContain('href="/bookings"');
    expect(html).toContain("Seats");
    expect(html).toContain("Not available yet");
    expect(html).not.toContain("/partner/seats");
  });

  it("should say the account is not linked and read nothing when partner_id is null", async () => {
    requirePermissionMock.mockResolvedValue({ ...USER, partner_id: null });

    const html = await render();

    expect(html).toContain("Your account is not linked to a partner yet");
    expect(getSummaryMock).not.toHaveBeenCalled();
    expect(getMetricsMock).not.toHaveBeenCalled();
  });

  it("should say the partner could not be found, not show zeros, when the partner row is not visible", async () => {
    getSummaryMock.mockResolvedValue(null);

    const html = await render();

    expect(html).toContain("Your partner could not be found");
    expect(html).not.toContain(">0<");
  });

  it("should mark unreadable figures as unavailable with a retry, never as zero", async () => {
    getMetricsMock.mockResolvedValue([
      result("bookings_pending", null),
      result("bookings_in_progress", null),
    ]);

    const html = await render();

    expect(html).toContain("Unavailable");
    expect(html).toContain("RETRY_BUTTON");
    expect(html).not.toContain(">0<");
  });

  it("should say there is no data yet when every figure is zero", async () => {
    getMetricsMock.mockResolvedValue([result("bookings_pending", 0)]);

    expect(await render()).toContain("No operational data yet");
  });

  it("should let a failed partner read reach the error boundary", async () => {
    getSummaryMock.mockRejectedValue(new Error("Could not read the partner"));

    await expect(render()).rejects.toThrow("Could not read the partner");
  });
});
