import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAnyPermissionMock = vi.hoisted(() => vi.fn());
const maybeSingleMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const rpcMock = vi.hoisted(() => vi.fn());
const lookupsMock = vi.hoisted(() => vi.fn());
const existingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/current-user", () => ({ requireAnyPermission: requireAnyPermissionMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })) }));
vi.mock("@/features/bookings/lib/get-booking-import-lookups", () => ({
  getBookingImportLookups: lookupsMock,
  getExistingExternalNumbers: existingMock,
}));

import { confirmBookingImportAction } from "@/features/bookings/actions/confirm-booking-import.action";
import { buildBookingImportTemplateCsv } from "@/features/bookings/lib/booking-import-template";

const PARTNER_ID = "a0000000-0000-0000-0000-000000000001";
const AIRPORT_ID = "b0000000-0000-0000-0000-000000000001";
const CATEGORY_ID = "c0000000-0000-0000-0000-000000000001";
const GOOD = (number: string) => `${number},2026-11-08 09:30,2026-11-10 09:30,EK 203,Infant,0-12 months,Sedan,,45.50`;
const BAD = "EXT-9,2026-11-08 09:30,2026-11-10 09:30,EK 203,Premium,,,,45.50";
const csv = (...rows: string[]) => [buildBookingImportTemplateCsv().trim(), ...rows].join("\r\n");

const form = (content = csv(GOOD("EXT-1"), GOOD("EXT-2"), BAD), name = "bookings.csv") => {
  const data = new FormData();
  data.set("partner_id", PARTNER_ID);
  data.set("file", new File([content], name));
  return data;
};

describe("confirmBookingImportAction (CO-F07-S05)", () => {
  beforeEach(() => {
    requireAnyPermissionMock.mockReset();
    requireAnyPermissionMock.mockResolvedValue({ id: "u-1", role: "operations_manager", full_name: "Priya Nair" });
    maybeSingleMock.mockReset();
    maybeSingleMock.mockResolvedValue({ data: { id: PARTNER_ID, name: "Emirates Rent A Car" }, error: null });
    fromMock.mockReset();
    fromMock.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) });
    existingMock.mockReset();
    existingMock.mockResolvedValue(new Set());
    lookupsMock.mockReset();
    lookupsMock.mockResolvedValue({
      airport: { id: AIRPORT_ID, timezone: "Asia/Dubai" },
      categoryIdsByName: new Map([["infant", CATEGORY_ID]]),
    });
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: { import_id: "i-1", created: [{ row_number: 1 }, { row_number: 2 }], rejected: [] },
      error: null,
    });
  });

  it("should create only the valid rows, in one database call, and answer with what was done (R2, R10)", async () => {
    const answer = await confirmBookingImportAction(form());

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe("import_bookings");
    expect(args).toMatchObject({
      p_partner_id: PARTNER_ID,
      p_airport_id: AIRPORT_ID,
      p_file_name: "bookings.csv",
      p_total_rows: 3,
    });
    expect(args.p_rows.map((row: { external_booking_number: string }) => row.external_booking_number)).toEqual(["EXT-1", "EXT-2"]);
    expect(answer).toMatchObject({
      success: true,
      result: { total: 3, created: 2, excluded: 1, partner_name: "Emirates Rent A Car", imported_by: "Priya Nair" },
    });
  });

  it("should leave out a row the partner already has and never send it to the database (S04)", async () => {
    existingMock.mockResolvedValue(new Set(["EXT-1"]));

    await confirmBookingImportAction(form());

    const rows = rpcMock.mock.calls[0][1].p_rows as Array<{ external_booking_number: string }>;
    expect(rows.map((row) => row.external_booking_number)).toEqual(["EXT-2"]);
  });

  it("should count a row the database refuses as excluded", async () => {
    rpcMock.mockResolvedValue({
      data: { import_id: "i-1", created: [{ row_number: 1 }], rejected: [{ row_number: 2, reason: "Duplicate external booking number" }] },
      error: null,
    });

    expect(await confirmBookingImportAction(form())).toMatchObject({ success: true, result: { created: 1, excluded: 2 } });
  });

  it("should answer NOTHING_TO_IMPORT and call no function when no row is valid", async () => {
    expect(await confirmBookingImportAction(form(csv(BAD)))).toEqual({ success: false, code: "NOTHING_TO_IMPORT" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should answer IMPORT_FAILED when the database fails, so the user knows nothing was created", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });

    expect(await confirmBookingImportAction(form())).toEqual({ success: false, code: "IMPORT_FAILED" });
  });

  it("should check the file again and refuse a wrong header without calling the database", async () => {
    expect(await confirmBookingImportAction(form("a,b\r\n1,2"))).toEqual({ success: false, code: "WRONG_HEADER" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("should refuse a user without the import permission and look at nothing", async () => {
    requireAnyPermissionMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(confirmBookingImportAction(form())).rejects.toThrow("FORBIDDEN");
    expect(fromMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
