import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getCoreKpisMock = vi.hoisted(() => vi.fn());
const getAdditionalKpisMock = vi.hoisted(() => vi.fn());
const getPartnerSummaryMock = vi.hoisted(() => vi.fn());
const getBaselineInputsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/kpi/get-core-kpis", () => ({ getCoreKpis: getCoreKpisMock }));
vi.mock("@/lib/kpi/get-additional-kpis", () => ({ getAdditionalKpis: getAdditionalKpisMock }));
vi.mock("@/features/partners/lib/get-partner-summary", () => ({ getPartnerSummary: getPartnerSummaryMock }));
vi.mock("@/features/roi/lib/get-baseline-inputs", () => ({ getBaselineInputs: getBaselineInputsMock }));

import { GET } from "@/app/api/reports/roi/route";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";

const call = (search = "?period=2026-10") => GET(new Request(`http://localhost/api/reports/roi${search}`) as never);

const asUser = (role: string) =>
  getCurrentUserMock.mockResolvedValue({
    id: "u-1",
    email: "nadia@example.com",
    full_name: "Nadia Hassan",
    role,
    partner_id: role === "partner_user" ? "p-a" : null,
    partner_status: role === "partner_user" ? "active" : null,
    is_active: true,
  });

const ADDITIONAL: AdditionalKpis = {
  seat_utilisation: { state: "value", value: 68 },
  average_rental_duration: { state: "value", value: 5.2 },
  inventory_buffer: { state: "value", seats: 16, airports: "DXB" },
  replacement_rate: { state: "value", percent: 0.8, replacements: 2, rentals: 240 },
  average_preparation: { state: "value", value: 24 },
  installation_time: { state: "value", value: 12 },
  refunds: { state: "value", amount: 150, refunded_bookings: 3 },
  complaints: { state: "not_available", reason: "No complaint record exists yet" },
};

const KPIS: CoreKpis = {
  correct_seat: { state: "value", percent: 99.2, numerator: 238, denominator: 240, excluded: 0 },
  family_ready_on_time: { state: "value", percent: 97.5, numerator: 234, denominator: 240, excluded: 0 },
  traceability: { state: "value", percent: 100, numerator: 240, denominator: 240, excluded: 0 },
  incidents: { state: "value", incidents: 3, completed_bookings: 240, percent: 1.25 },
  commercial: { state: "value", amount: 6000 },
};

describe("GET /api/reports/roi (VI-F05-T03)", () => {
  beforeEach(() => {
    for (const mock of [getCurrentUserMock, getCoreKpisMock, getAdditionalKpisMock, getPartnerSummaryMock, getBaselineInputsMock]) mock.mockReset();
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: KPIS });
    getAdditionalKpisMock.mockResolvedValue({ ok: true, kpis: ADDITIONAL });
    getPartnerSummaryMock.mockResolvedValue({ name: "Emirates Rent A Car", code: "EMR" });
    getBaselineInputsMock.mockResolvedValue(null);
    asUser("operations_manager");
  });

  it("should give the ROI report as a CSV download with the verified results marked Verified (AC01, AC03)", async () => {
    const response = await call();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="roi-report-2026-10.csv"');
    expect(body).toContain('Verified results,Verified,Verified partner revenue,"USD 6,000"');
    expect(body).toContain(",Estimate,");
  });

  it("should say Not available for the estimates of the internal team, which has no baseline, not 0 (AC04)", async () => {
    const body = await (await call()).text();

    expect(getBaselineInputsMock).not.toHaveBeenCalled();
    expect(body).toContain("Estimated avoided costs,Not available");
  });

  it("should read the baseline of the partner on the profile of a partner user only (AC05)", async () => {
    asUser("partner_user");

    await call("?period=2026-10&partner_id=b0000000-0000-0000-0000-000000000002");

    expect(getBaselineInputsMock).toHaveBeenCalledTimes(1);
    expect(getBaselineInputsMock).toHaveBeenCalledWith("p-a");
  });

  it.each([
    ["is not signed in", null, 401],
    ["is a technician", { role: "technician" }, 403],
  ])("should refuse a caller who %s", async (_name, user, status) => {
    getCurrentUserMock.mockResolvedValue(user && { id: "u-1", email: "a@b.c", full_name: "A", is_active: true, partner_id: null, partner_status: null, ...user });

    expect((await call()).status).toBe(status);
    expect(getCoreKpisMock).not.toHaveBeenCalled();
  });

  it("should answer a failed read with the standardized error, never a file (AC08)", async () => {
    getAdditionalKpisMock.mockResolvedValue({ ok: false, reason: "unavailable" });

    const response = await call();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });
});
