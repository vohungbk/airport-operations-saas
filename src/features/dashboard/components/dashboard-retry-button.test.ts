import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isRefreshing: false, refresh: vi.fn() }));

vi.mock("@/features/dashboard/lib/use-dashboard-refresh", () => ({
  useDashboardRefresh: () => state,
}));

import { DashboardRetryButton } from "@/features/dashboard/components/dashboard-retry-button";

describe("DashboardRetryButton", () => {
  beforeEach(() => {
    state.isRefreshing = false;
  });

  it("should offer Try again when idle", () => {
    const html = renderToStaticMarkup(createElement(DashboardRetryButton));

    expect(html).toContain("Try again");
    expect(html).not.toContain('disabled=""');
  });

  it("should be disabled and say Retrying while the page is counting again", () => {
    state.isRefreshing = true;

    const html = renderToStaticMarkup(createElement(DashboardRetryButton));

    expect(html).toContain("Retrying...");
    expect(html).toContain('disabled=""');
  });
});
