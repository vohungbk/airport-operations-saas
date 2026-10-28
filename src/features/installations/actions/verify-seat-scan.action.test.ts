import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const getContextMock = vi.hoisted(() => vi.fn());
const getByTokenMock = vi.hoisted(() => vi.fn());
const getBySerialMock = vi.hoisted(() => vi.fn());
const getChecksMock = vi.hoisted(() => vi.fn());
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/features/installations/lib/get-installation-context", () => ({ getInstallationContext: getContextMock }));
vi.mock("@/features/seats/lib/get-seat-by-token", () => ({ getSeatByPublicToken: getByTokenMock }));
vi.mock("@/features/seats/lib/get-seat-by-serial", () => ({ getSeatBySerial: getBySerialMock }));
vi.mock("@/features/installations/lib/get-seat-last-checks", () => ({ getSeatLastChecks: getChecksMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { verifySeatScanAction } from "@/features/installations/actions/verify-seat-scan.action";
import { INSTALLATION_RECORD_PERMISSIONS } from "@/lib/auth/permissions";

const JOB_ID = "e0000000-0000-0000-0000-000000000001";
const TOKEN = "11111111-2222-3333-4444-555555555555";
const ASSIGNED = { id: "s-1", serial_number: "SEAT-0001", status: "reserved", category_name: "Convertible" };

const context = (seat: unknown = ASSIGNED) => ({
  job: { id: JOB_ID, status: "assigned", job_type: "installation", technician_id: "t-1" },
  booking: { booking_number: "BK-1", airport: { code: "DXB", name: "Dubai", timezone: "Asia/Dubai" }, seat },
  installation: null,
});

const scannedSeat = (overrides: Record<string, unknown> = {}) => ({
  id: "s-1",
  serial_number: "SEAT-0001",
  status: "reserved",
  quarantine_reason: null,
  retired_at: null,
  category: { name: "Convertible" },
  airport: { code: "DXB", name: "Dubai" },
  ...overrides,
});

describe("verifySeatScanAction", () => {
  beforeEach(() => {
    for (const mock of [requireAnyPermissionMock, getContextMock, getByTokenMock, getBySerialMock, getChecksMock, createClientMock]) {
      mock.mockReset();
    }
    requireAnyPermissionMock.mockResolvedValue({ id: "t-1", role: "technician" });
    getContextMock.mockResolvedValue(context());
    getChecksMock.mockResolvedValue({ last_cleaning: null, last_inspection: null });
  });

  it("should guard the action with the installation permissions", async () => {
    getByTokenMock.mockResolvedValue(scannedSeat());

    await verifySeatScanAction({ job_id: JOB_ID, code: TOKEN });

    expect(requireAnyPermissionMock).toHaveBeenCalledWith(INSTALLATION_RECORD_PERMISSIONS);
  });

  it("should propagate the guard's refusal and read nothing", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(verifySeatScanAction({ job_id: JOB_ID, code: TOKEN })).rejects.toThrow("FORBIDDEN");
    expect(getContextMock).not.toHaveBeenCalled();
  });

  it("should match the seat of a scanned QR address and give its last cleaning and inspection", async () => {
    getByTokenMock.mockResolvedValue(scannedSeat());
    getChecksMock.mockResolvedValue({
      last_cleaning: { at: "2026-10-24T09:20:00Z", passed: true },
      last_inspection: null,
    });

    const result = await verifySeatScanAction({ job_id: JOB_ID, code: `https://app.example.com/q/${TOKEN}` });

    expect(getByTokenMock).toHaveBeenCalledWith(TOKEN);
    expect(result).toMatchObject({
      success: true,
      scan: {
        match: true,
        assigned: { serial_number: "SEAT-0001", category_name: "Convertible", airport_code: "DXB" },
        scanned: { serial_number: "SEAT-0001" },
        checks: { last_cleaning: { passed: true }, last_inspection: null },
      },
    });
  });

  it("should match a typed serial, so the steps go on without a camera", async () => {
    getBySerialMock.mockResolvedValue(scannedSeat());

    const result = await verifySeatScanAction({ job_id: JOB_ID, code: " SEAT-0001 " });

    expect(getBySerialMock).toHaveBeenCalledWith("SEAT-0001");
    expect(result).toMatchObject({ success: true, scan: { match: true } });
  });

  it("should say mismatch for another seat, with what is known of it and no checks", async () => {
    getByTokenMock.mockResolvedValue(
      scannedSeat({ id: "s-5", serial_number: "SEAT-0005", status: "reserved" }),
    );

    const result = await verifySeatScanAction({ job_id: JOB_ID, code: TOKEN });

    expect(result).toMatchObject({
      success: true,
      scan: {
        match: false,
        assigned: { serial_number: "SEAT-0001" },
        scanned: { serial_number: "SEAT-0005", category_name: "Convertible", status: "reserved" },
        checks: null,
      },
    });
    expect(getChecksMock).not.toHaveBeenCalled();
  });

  it("should say mismatch, with no seat data, for a code of a seat the technician cannot read", async () => {
    getByTokenMock.mockResolvedValue(null);

    const result = await verifySeatScanAction({ job_id: JOB_ID, code: TOKEN });

    expect(result).toMatchObject({
      success: true,
      scan: { match: false, scanned: { serial_number: null, category_name: null, status: null } },
    });
  });

  it("should keep the typed serial in a mismatch for a seat that cannot be read", async () => {
    getBySerialMock.mockResolvedValue(null);

    const result = await verifySeatScanAction({ job_id: JOB_ID, code: "SEAT-0099" });

    expect(result).toMatchObject({ success: true, scan: { match: false, scanned: { serial_number: "SEAT-0099" } } });
  });

  it("should return the validation error for an empty code, a bad address or a bad job, and read nothing", async () => {
    for (const input of [
      { job_id: JOB_ID, code: "  " },
      { job_id: JOB_ID, code: "https://app.example.com/jobs/1" },
      { job_id: "nope", code: "SEAT-0001" },
      null,
    ]) {
      await expect(verifySeatScanAction(input)).resolves.toEqual({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      });
    }
    expect(getContextMock).not.toHaveBeenCalled();
  });

  it("should say not found for a job that is not the technician's, and look up no seat", async () => {
    getContextMock.mockResolvedValue(null);

    await expect(verifySeatScanAction({ job_id: JOB_ID, code: TOKEN })).resolves.toEqual({
      success: false,
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
    expect(getByTokenMock).not.toHaveBeenCalled();
  });

  it("should refuse a job whose booking has no seat", async () => {
    getContextMock.mockResolvedValue(context(null));

    await expect(verifySeatScanAction({ job_id: JOB_ID, code: TOKEN })).resolves.toMatchObject({
      success: false,
      error: { code: "SEAT_NOT_ELIGIBLE" },
    });
  });

  it("should grant nothing: a scan writes no row", async () => {
    getByTokenMock.mockResolvedValue(scannedSeat());

    await verifySeatScanAction({ job_id: JOB_ID, code: TOKEN });

    expect(createClientMock).not.toHaveBeenCalled();
  });
});
