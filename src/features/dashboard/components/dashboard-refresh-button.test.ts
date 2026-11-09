import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isRefreshing: false, refresh: vi.fn() }));

vi.mock("@/features/dashboard/lib/use-dashboard-refresh", () => ({
  useDashboardRefresh: () => state,
}));

import { CommandCentreHeading } from "@/features/dashboard/components/command-centre-heading";
import { DashboardRefreshButton } from "@/features/dashboard/components/dashboard-refresh-button";

describe("DashboardRefreshButton", () => {
  beforeEach(() => {
    state.isRefreshing = false;
  });

  it("should offer Refresh when idle", () => {
    const html = renderToStaticMarkup(createElement(DashboardRefreshButton));

    expect(html).toContain("Refresh");
    expect(html).not.toContain('disabled=""');
  });

  it("should be disabled and say Refreshing while the figures are counted again", () => {
    state.isRefreshing = true;

    const html = renderToStaticMarkup(createElement(DashboardRefreshButton));

    expect(html).toContain("Refreshing...");
    expect(html).toContain('disabled=""');
  });
});

describe("CommandCentreHeading", () => {
  it("should show the title, the refresh button and the load time", () => {
    const html = renderToStaticMarkup(
      createElement(CommandCentreHeading, { loadedAt: new Date("2026-10-24T14:04:00Z") }),
    );

    expect(html).toContain("Command Centre");
    expect(html).toContain("Refresh");
    expect(html).toContain("Loaded 14:04 UTC");
    expect(html).toContain("24 Oct 2026");
  });
});
