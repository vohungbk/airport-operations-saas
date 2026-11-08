import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserMock = vi.hoisted(() => vi.fn());
const getCoreKpisMock = vi.hoisted(() => vi.fn());
const getAdditionalKpisMock = vi.hoisted(() => vi.fn());
const getPartnerSummaryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/kpi/get-core-kpis", () => ({ getCoreKpis: getCoreKpisMock }));
vi.mock("@/lib/kpi/get-additional-kpis", () => ({ getAdditionalKpis: getAdditionalKpisMock }));
vi.mock("@/features/partners/lib/get-partner-summary", () => ({ getPartnerSummary: getPartnerSummaryMock }));

import { GET } from "@/app/api/reports/kpi/route";
import type { AdditionalKpis } from "@/lib/kpi/get-additional-kpis";
import type { CoreKpis } from "@/lib/kpi/get-core-kpis";

const call = (search = "?period=2026-10") => GET(new Request(`http://localhost/api/reports/kpi${search}`) as never);

const asUser = (role: string, extra: Record<string, unknown> = {}) =>
  getCurrentUserMock.mockResolvedValue({
    id: "u-1",
    email: "nadia@example.com",
    full_name: "Nadia Hassan",
    role,
    partner_id: role === "partner_user" ? "p-a" : null,
    partner_status: role === "partner_user" ? "active" : null,
    is_active: true,
    ...extra,
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

describe("GET /api/reports/kpi (VI-F05-T03)", () => {
  beforeEach(() => {
    for (const mock of [getCurrentUserMock, getCoreKpisMock, getAdditionalKpisMock, getPartnerSummaryMock]) mock.mockReset();
    getCoreKpisMock.mockResolvedValue({ ok: true, kpis: KPIS });
    getAdditionalKpisMock.mockResolvedValue({ ok: true, kpis: ADDITIONAL });
    getPartnerSummaryMock.mockResolvedValue({ name: "Emirates Rent A Car", code: "EMR" });
    asUser("operations_manager");
  });

  it("should give the KPI report of the period as a CSV download (AC01)", async () => {
    const response = await call();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="kpi-report-2026-10.csv"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toContain("Period,October 2026");
    expect(body).toContain("Exported by,Nadia Hassan");
    expect(body).toContain("Core programme KPIs,Verified,Correct-seat fulfilment,99.2%,238 / 240");
  });

  it("should still give a file with the header and a No data note when the period has nothing (AC06)", async () => {
    const no_data = { state: "no_data" } as const;
    getCoreKpisMock.mockResolvedValue({
      ok: true,
      kpis: { correct_seat: no_data, family_ready_on_time: no_data, traceability: no_data, incidents: no_data, commercial: no_data },
    });

    const body = await (await call()).text();

    expect(body).toContain("Section,Type,Figure,Value,Detail");
    expect(body).toContain("Note,No data in this period.");
  });

  it("should give a partner user the partner of its own profile, whatever partner the address names (AC05)", async () => {
    asUser("partner_user");

    const body = await (await call("?period=2026-10&partner_id=b0000000-0000-0000-0000-000000000002")).text();

    expect(getPartnerSummaryMock).toHaveBeenCalledWith("p-a");
    expect(body).toContain("Scope,Emirates Rent A Car");
  });

  it("should give the internal team the scope of every partner", async () => {
    expect(await (await call()).text()).toContain("Scope,All partners");
  });

  it.each([
    ["is not signed in", null, 401, "UNAUTHORIZED"],
    ["is a technician", { role: "technician" }, 403, "FORBIDDEN"],
    ["is a partner user with no partner", { role: "partner_user", partner_id: null, partner_status: null }, 403, "FORBIDDEN"],
  ])("should refuse a caller who %s", async (_name, user, status, code) => {
    getCurrentUserMock.mockResolvedValue(user && { id: "u-1", email: "a@b.c", full_name: "A", is_active: true, partner_id: null, partner_status: null, ...user });

    const response = await call();

    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(code);
    expect(getCoreKpisMock).not.toHaveBeenCalled();
  });

  it("should answer a period in the future with the standardized validation error", async () => {
    const response = await call("?period=2099-01");

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("should answer a failed read with the standardized error, never a file (AC08)", async () => {
    getCoreKpisMock.mockResolvedValue({ ok: false, reason: "unavailable" });

    const response = await call();

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });
});
