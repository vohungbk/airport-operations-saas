import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePermissionMock = vi.hoisted(() => vi.fn());
const dashboardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requirePermission: requirePermissionMock }));
vi.mock("@/features/roi/components/roi-dashboard", () => ({ RoiDashboard: dashboardMock }));

import RoiError from "@/app/(dashboard)/roi/error";
import RoiLayout from "@/app/(dashboard)/roi/layout";
import RoiLoading from "@/app/(dashboard)/roi/loading";
import RoiPage from "@/app/(dashboard)/roi/page";

describe("the ROI dashboard of the internal team (VI-F05-S04, AC01)", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset();
    requirePermissionMock.mockResolvedValue({ id: "u-1", role: "admin" });
    dashboardMock.mockReset();
  });

  it("should guard the area with dashboards:view", async () => {
    await RoiLayout({ children: null });

    expect(requirePermissionMock).toHaveBeenCalledWith("dashboards:view");
  });

  it("should refuse a technician or a partner user with the forbidden answer (permission denied)", async () => {
    requirePermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(RoiLayout({ children: null })).rejects.toThrow("FORBIDDEN");
  });

  it("should show the figures of all partners for the period of the address", async () => {
    const element = (await RoiPage({ searchParams: Promise.resolve({ period: "ytd" }) })) as {
      props: { scope_label: string; period?: string };
    };

    expect(element.props).toEqual({ scope_label: "All partners", period: "ytd" });
  });

  it("should hand the comparison choice to the dashboard", async () => {
    const element = (await RoiPage({ searchParams: Promise.resolve({ compare: "off" }) })) as {
      props: { compare?: string };
    };

    expect(element.props.compare).toBe("off");
  });

  it("should hand the search to the dashboard", async () => {
    const element = (await RoiPage({ searchParams: Promise.resolve({ q: "seat" }) })) as { props: { q?: string } };

    expect(element.props.q).toBe("seat");
  });

  it("should render the shared loading and error states", () => {
    expect(renderToStaticMarkup(createElement(RoiLoading))).toContain('aria-busy="true"');
    expect(renderToStaticMarkup(createElement(RoiError, { error: new Error("x"), reset: vi.fn() }))).toContain(
      "Could not load the ROI dashboard",
    );
  });
});
