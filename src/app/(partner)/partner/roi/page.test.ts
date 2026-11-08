import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePartnerScopeMock = vi.hoisted(() => vi.fn());
const getSummaryMock = vi.hoisted(() => vi.fn());
const getBaselineMock = vi.hoisted(() => vi.fn());
const dashboardMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requirePartnerScope: requirePartnerScopeMock }));
vi.mock("@/features/partners/lib/get-partner-summary", () => ({ getPartnerSummary: getSummaryMock }));
vi.mock("@/features/roi/lib/get-baseline-inputs", () => ({ getBaselineInputs: getBaselineMock }));
vi.mock("@/features/roi/components/roi-dashboard", () => ({ RoiDashboard: dashboardMock }));

import PartnerRoiPage from "@/app/(partner)/partner/roi/page";

const USER = { id: "user-1", role: "partner_user" as const, partner_id: "partner-a" };

const render = (period?: string | string[], compare?: string, q?: string) =>
  PartnerRoiPage({ searchParams: Promise.resolve({ period, compare, q }) });

describe("PartnerRoiPage (VI-F05-S04, AC01)", () => {
  beforeEach(() => {
    requirePartnerScopeMock.mockReset();
    requirePartnerScopeMock.mockResolvedValue(USER);
    getSummaryMock.mockReset();
    getSummaryMock.mockResolvedValue({ name: "Emirates Rent A Car", code: "EMR" });
    getBaselineMock.mockReset();
    getBaselineMock.mockResolvedValue(null);
    dashboardMock.mockReset();
  });

  it("should guard the page with bookings:view_own_partner", async () => {
    await render();

    expect(requirePartnerScopeMock).toHaveBeenCalledWith("bookings:view_own_partner");
  });

  it("should refuse a user without the permission, and read nothing (permission denied)", async () => {
    requirePartnerScopeMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(render()).rejects.toThrow("FORBIDDEN");
    expect(getSummaryMock).not.toHaveBeenCalled();
  });

  it("should read the partner of the signed-in user, never one taken from the request", async () => {
    await render("2026-10");

    expect(getSummaryMock).toHaveBeenCalledWith("partner-a");
  });

  it("should hand the partner name and the period to the dashboard", async () => {
    const element = (await render("2026-10")) as { props: { scope_label: string; period?: string } };

    expect(element.props).toEqual({
      scope_label: "Emirates Rent A Car",
      scope_note: "Your partner data only",
      edit_baseline_href: "/partner/roi/baseline",
      baseline: null,
      period: "2026-10",
    });
  });

  it("should read the baseline of the signed-in partner and hand it to the dashboard (VI-F05-S06)", async () => {
    getBaselineMock.mockResolvedValue({ handling_cost_per_rental: 5 });

    const element = (await render()) as { props: { baseline?: unknown } };

    expect(getBaselineMock).toHaveBeenCalledWith("partner-a");
    expect(element.props.baseline).toEqual({ handling_cost_per_rental: 5 });
  });

  it("should give the partner the way to Edit baseline inputs (VI-F05-S05, AC07)", async () => {
    const element = (await render()) as { props: { edit_baseline_href?: string } };

    expect(element.props.edit_baseline_href).toBe("/partner/roi/baseline");
  });

  it("should hand the comparison choice to the dashboard", async () => {
    const element = (await render("2026-10", "off")) as { props: { compare?: string } };

    expect(element.props.compare).toBe("off");
  });

  it("should hand the search to the dashboard", async () => {
    const element = (await render(undefined, undefined, "seat")) as { props: { q?: string } };

    expect(element.props.q).toBe("seat");
  });

  it("should use the first value when the period is repeated in the address", async () => {
    const element = (await render(["2026-10", "2026-09"])) as { props: { period?: string } };

    expect(element.props.period).toBe("2026-10");
  });
});
