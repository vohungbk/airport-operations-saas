import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const dashboardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/features/kpi/components/kpi-dashboard", () => ({ KpiDashboard: dashboardMock }));

import KpiError from "@/app/(dashboard)/kpi/error";
import KpiLayout from "@/app/(dashboard)/kpi/layout";
import KpiLoading from "@/app/(dashboard)/kpi/loading";
import KpiPage from "@/app/(dashboard)/kpi/page";

describe("the KPI dashboard of the internal team (VI-F05-S01, AC02)", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    dashboardMock.mockReset();
  });

  it("should guard the area with dashboards:view", async () => {
    await KpiLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should refuse a technician or a partner user with the forbidden answer (permission denied)", async () => {
    requirePermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(KpiLayout({ children: null })).rejects.toThrow("FORBIDDEN");
  });

  it("should show the figures of all partners for the period of the address", async () => {
    const element = (await KpiPage({ searchParams: Promise.resolve({ period: "ytd" }) })) as {
      props: { scope_label: string; period?: string };
    };

    expect(element.props).toEqual({ scope_label: "All partners", period: "ytd" });
  });

  it("should hand the comparison choice to the dashboard", async () => {
    const element = (await KpiPage({ searchParams: Promise.resolve({ compare: "off" }) })) as {
      props: { compare?: string };
    };

    expect(element.props.compare).toBe("off");
  });

  it("should hand the search to the dashboard", async () => {
    const element = (await KpiPage({ searchParams: Promise.resolve({ q: "seat" }) })) as { props: { q?: string } };

    expect(element.props.q).toBe("seat");
  });

  it("should render the shared loading and error states", () => {
    expect(renderToStaticMarkup(createElement(KpiLoading))).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(createElement(KpiError, { error: new Error("x"), reset: vi.fn() }))).toContain(
      "Could not load the KPIs",
    );
  });
});
